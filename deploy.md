# Deploy Skyline Weather to EC2

This guide deploys the app to an Ubuntu EC2 instance with:

- Node.js running as an unprivileged system user under `systemd`
- Nginx proxying public HTTP/HTTPS traffic to the app on `localhost:3000`
- A custom domain and a free TLS certificate from Let's Encrypt

The app uses Open-Meteo and does not need an API key. Commands below assume Ubuntu 22.04 or 24.04 and a domain such as `weather.example.com`; replace the example domain with yours.

## 1. Prepare the EC2 instance and domain

1. Launch an Ubuntu EC2 instance and assign it a stable public address. An Elastic IP is recommended so the address does not change when the instance is stopped and started.
2. In the instance's security group, allow:
   - SSH (TCP 22) only from your own IP address.
   - HTTP (TCP 80) from `0.0.0.0/0` and, if using IPv6, `::/0`.
   - HTTPS (TCP 443) from `0.0.0.0/0` and, if using IPv6, `::/0`.
3. At your DNS provider, create an `A` record for your domain pointing to the instance's Elastic IP. If you also want `www`, create a `CNAME` record for `www` pointing to your domain (or an equivalent `A` record). Add an `AAAA` record only if the instance is configured with a working public IPv6 address. DNS changes can take time to propagate.
4. Connect to the instance using the Ubuntu AMI's default login user:

   ```sh
   ssh -i /path/to/key.pem ubuntu@YOUR_ELASTIC_IP
   ```

## 2. Install system packages and Node.js

Install Git, Nginx, and Node.js 22:

```sh
sudo apt update
sudo apt install -y ca-certificates curl git nginx
curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource_setup.sh
sudo -E bash /tmp/nodesource_setup.sh
rm /tmp/nodesource_setup.sh
sudo apt install -y nodejs
node --version
npm --version
```

Confirm Node.js is version 18 or newer, as required by the app.

## 3. Install the app

Create a dedicated system user and deploy the repository under `/opt/weather/app`:

```sh
sudo useradd --system --create-home --home-dir /opt/weather --shell /usr/sbin/nologin weather
sudo git clone https://github.com/Ifenimi/weather_application_2026.git /opt/weather/app
sudo chown -R weather:weather /opt/weather
sudo -u weather npm --prefix /opt/weather/app ci --omit=dev
```

Run the tests before enabling the service:

```sh
cd /opt/weather/app
npm test
```

## 4. Create the systemd service

Create `/etc/systemd/system/weather.service`:

```ini
[Unit]
Description=Skyline Weather application
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=weather
Group=weather
WorkingDirectory=/opt/weather/app
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/node /opt/weather/app/server.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict

[Install]
WantedBy=multi-user.target
```

Load the service and start it at boot:

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now weather
sudo systemctl status weather --no-pager
```

Check the local app response before configuring the public proxy:

```sh
curl -I http://127.0.0.1:3000/
```

The Node server listens on port 3000. Do not open this port in the EC2 security group; Nginx is the public entry point.

## 5. Configure Nginx for your domain

Create `/etc/nginx/sites-available/weather` and replace both instances of `weather.example.com` with your domain:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name weather.example.com www.weather.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

If you are not using `www`, remove `www.weather.example.com` from `server_name` and from the Certbot command below.

Enable the site, validate the Nginx configuration, and reload Nginx:

```sh
sudo ln -s /etc/nginx/sites-available/weather /etc/nginx/sites-enabled/weather
sudo nginx -t
sudo systemctl reload nginx
```

Once DNS has propagated, verify that the domain serves the app over HTTP:

```sh
curl -I http://weather.example.com/
```

## 6. Enable HTTPS

Install Certbot and its Nginx integration:

```sh
sudo apt install -y certbot python3-certbot-nginx
```

Request and install a certificate. Replace the email address and domain names:

```sh
sudo certbot --nginx \
  -d weather.example.com \
  -d www.weather.example.com \
  --redirect \
  --agree-tos \
  --no-eff-email \
  --email you@example.com
```

If you are not using `www`, omit its `-d` option. Certbot configures Nginx to serve HTTPS and redirect HTTP to HTTPS. Check renewal:

```sh
sudo certbot renew --dry-run
```

## 7. Verify the deployment

Open `https://weather.example.com` in a browser, then try a city search and the Celsius/Fahrenheit control. The frontend calls the app's Express API, and the server fetches forecasts from Open-Meteo.

Useful checks:

```sh
sudo systemctl is-active weather
sudo systemctl status weather --no-pager
sudo journalctl -u weather -n 100 --no-pager
sudo nginx -t
curl -I https://weather.example.com/
curl "https://weather.example.com/api/geocode?q=London"
```

## 8. Deploy updates

Connect to the instance and update the checkout. Replace `main` if your deployment branch has a different name:

```sh
cd /opt/weather/app
sudo -u weather git -C /opt/weather/app fetch origin
sudo -u weather git -C /opt/weather/app checkout main
sudo -u weather git -C /opt/weather/app pull --ff-only origin main
sudo -u weather npm --prefix /opt/weather/app ci --omit=dev
sudo -u weather npm --prefix /opt/weather/app test
sudo systemctl restart weather
sudo systemctl status weather --no-pager
```

If an update does not start correctly, inspect `sudo journalctl -u weather -n 100 --no-pager` and restore the previous deployment revision before restarting the service.

const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const app = require("../server");

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

test("serves the weather app interface", async () => {
  const response = await fetch(baseUrl);
  const page = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.match(page, /Weather, wherever you are/);
});

test("rejects city searches that are too short", async () => {
  const response = await fetch(`${baseUrl}/api/geocode?q=a`);
  const data = await response.json();

  assert.equal(response.status, 400);
  assert.match(data.error, /city name/);
});

test("rejects invalid weather coordinates", async () => {
  const response = await fetch(`${baseUrl}/api/weather?latitude=91&longitude=0`);
  const data = await response.json();

  assert.equal(response.status, 400);
  assert.match(data.error, /valid latitude and longitude/);
});

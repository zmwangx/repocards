const rewire = require("rewire");
const test = require("ava");

const cards = rewire("./cards");

const formatCount = cards.__get__("formatCount");

for (const [input, expected] of [
  [999, "999"],
  [1000, "1k"],
  [1049, "1k"],
  [1050, "1.1k"],
  [1949, "1.9k"],
  [1950, "2k"],
  [9949, "9.9k"],
  [9950, "10k"],
  [10049, "10k"],
  [10050, "10.1k"],
  [100100, "100k"],
  [100500, "101k"],
]) {
  test(`formatCount-${input}`, t => {
    t.is(formatCount(input), expected);
  });
}

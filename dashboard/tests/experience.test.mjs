import test from "node:test";
import assert from "node:assert/strict";
import {
  countries,
  normalizePhone,
  suggestedCountry,
  localMoment,
} from "../src/lib/experience.js";

test("country picker supports international destinations and shared calling codes", () => {
  assert.ok(countries.length >= 240);
  for (const [code, dial] of [
    ["US", "+1"],
    ["CA", "+1"],
    ["IN", "+91"],
    ["GB", "+44"],
    ["AE", "+971"],
    ["ZA", "+27"],
  ])
    assert.equal(countries.find((country) => country.code === code).dial, dial);
});
test("national formats, spaces, trunk prefixes and international paste normalize to E.164", () => {
  for (const [value, country, expected] of [
    ["(202) 555-0123", "US", "+12025550123"],
    ["98765 43210", "IN", "+919876543210"],
    ["07700 900123", "GB", "+447700900123"],
    ["06 12 34 56 78", "FR", "+33612345678"],
    ["02 36618 300", "IT", "+390236618300"],
    ["+44 7700 900123", "US", "+447700900123"],
    ["416 555 0123", "CA", "+14165550123"],
  ])
    assert.equal(normalizePhone(value, country).number, expected);
  assert.equal(normalizePhone("+44 7700 900123", "US").country, "GB");
});
test("empty, short, extensions and pasted prose cannot become OTP targets", () => {
  for (const value of [
    "",
    "123",
    "call +12025550123",
    "+12025550123 ext 9",
    "12345678901234567890123",
  ])
    assert.throws(() => normalizePhone(value, "US"));
});
test("country suggestions use explicit language regions with a predictable fallback", () => {
  assert.equal(suggestedCountry(["en-IN", "en-US"]), "IN");
  assert.equal(suggestedCountry(["en", "fr-CA"]), "CA");
  assert.equal(suggestedCountry(["invalid_locale"]), "US");
});
test("greetings follow local timezone across midnight and daylight-saving transitions", () => {
  const date = new Date("2026-09-12T00:30:00Z");
  assert.equal(
    localMoment(date, "en-US", "Asia/Tokyo").greeting,
    "Good morning",
  );
  assert.equal(
    localMoment(date, "en-US", "America/Los_Angeles").greeting,
    "Good evening",
  );
  assert.equal(
    localMoment(new Date("2026-09-12T07:00:00Z"), "en-US", "Asia/Kolkata")
      .greeting,
    "Good afternoon",
  );
  assert.equal(
    localMoment(
      new Date("2026-03-08T10:30:00Z"),
      "en-US",
      "America/Los_Angeles",
    ).time,
    "03:30 AM",
  );
});

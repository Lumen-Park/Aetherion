import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
} from "libphonenumber-js";

const supported = getCountries();
export const regionName = (code, locale = "en") => {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code);
  } catch {
    return code;
  }
};
export const countries = supported
  .map((code) => ({
    code,
    name: regionName(code),
    dial: `+${getCountryCallingCode(code)}`,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

export function suggestedCountry(languages = []) {
  for (const language of languages) {
    try {
      const region = new Intl.Locale(language).region;
      if (supported.includes(region)) return region;
    } catch {
      /* Invalid browser locale: continue to the next preference. */
    }
  }
  return "US";
}

export function normalizePhone(value, country) {
  if (!value.trim() || /[a-zA-Z]/.test(value))
    throw Error("Enter your phone number, including its area code.");
  const phone = parsePhoneNumberFromString(value.trim(), {
    defaultCountry: country,
    extract: false,
  });
  if (!phone || !phone.isPossible() || phone.ext)
    throw Error(
      "Check the number and selected country. Include the area code.",
    );
  const possibleCountries = phone.getPossibleCountries();
  const matchedCountry =
    phone.country ||
    (possibleCountries.includes(country) ? country : possibleCountries[0]);
  if (!matchedCountry)
    throw Error("Use a phone number assigned to a country or region.");
  return {
    number: phone.number,
    country: matchedCountry,
    display: phone.formatInternational(),
  };
}

export function localMoment(date = new Date(), locale, timeZone) {
  const options = timeZone ? { timeZone } : {};
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      ...options,
      hour: "numeric",
      hourCycle: "h23",
    }).format(date),
  );
  const period =
    hour >= 5 && hour < 12
      ? "morning"
      : hour >= 12 && hour < 17
        ? "afternoon"
        : "evening";
  const prompts = {
    morning: "A fresh perspective for the day ahead.",
    afternoon: "Make room for your next big idea.",
    evening: "A quiet moment. An extraordinary possibility.",
  };
  return {
    period,
    greeting: `Good ${period}`,
    prompt: prompts[period],
    time: new Intl.DateTimeFormat(locale, {
      ...options,
      hour: "2-digit",
      minute: "2-digit",
    }).format(date),
    date: new Intl.DateTimeFormat(locale, {
      ...options,
      weekday: "long",
      month: "short",
      day: "numeric",
    }).format(date),
    zone:
      timeZone ||
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      "Local time",
  };
}

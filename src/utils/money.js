const MAX_AMOUNT_WHOLE_UNITS = 9_999_999_999;

export const normalizeAmountInput = (value) =>
  String(value ?? "").replace(",", ".");

export const parseAmountToCents = (value) => {
  const amount = String(value ?? "").trim();
  const match = amount.match(/^(\d{1,10})(?:\.(\d{1,2}))?$/);
  if (!match) return null;

  const wholeUnits = Number(match[1]);
  const fractionalUnits = Number((match[2] || "").padEnd(2, "0"));
  if (wholeUnits > MAX_AMOUNT_WHOLE_UNITS) return null;

  const cents = wholeUnits * 100 + fractionalUnits;
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
};

export const amountCentsToDecimal = (cents) => {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new RangeError("El monto debe expresarse en centavos enteros no negativos.");
  }

  const wholeUnits = Math.floor(cents / 100);
  const fractionalUnits = String(cents % 100).padStart(2, "0");
  return `${wholeUnits}.${fractionalUnits}`;
};

export const sumAmountsToCents = (values) => values.reduce((total, value) => {
  const cents = parseAmountToCents(value);
  if (cents === null) {
    throw new TypeError("No se puede sumar un monto inválido.");
  }

  const nextTotal = total + cents;
  if (!Number.isSafeInteger(nextTotal)) {
    throw new RangeError("El total excede la precisión segura en centavos.");
  }

  return nextTotal;
}, 0);

export const formatCurrencyDecimal = (value, formatter) => {
  const match = String(value ?? "0").trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) {
    throw new TypeError("El valor monetario debe ser un decimal no negativo con hasta dos posiciones.");
  }

  const wholeUnits = BigInt(match[1]);
  const fractionalUnits = (match[2] || "").padEnd(2, "0");
  return formatter.formatToParts(wholeUnits)
    .map((part) => (part.type === "fraction" ? fractionalUnits : part.value))
    .join("");
};

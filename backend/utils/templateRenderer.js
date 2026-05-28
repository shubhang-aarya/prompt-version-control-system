import { makeHttpError } from "./http.js";

function formatTemplateValue(value) {
  if (value === null) {
    return "null";
  }

  const valueType = typeof value;

  if (valueType === "string" || valueType === "number" || valueType === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    throw makeHttpError(400, "Variable value cannot be serialized", {
      hint: "Use JSON-serializable variable values"
    });
  }
}

export function renderPromptTemplate(templateText, variables = {}) {
  const placeholderPattern = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;
  const placeholderMatches = [...templateText.matchAll(placeholderPattern)];

  if (placeholderMatches.length === 0) {
    return templateText;
  }

  const requiredVariables = [...new Set(placeholderMatches.map((match) => match[1]))];

  const missingVariables = requiredVariables.filter(
    (name) => !Object.prototype.hasOwnProperty.call(variables, name)
  );

  if (missingVariables.length > 0) {
    throw makeHttpError(400, "Missing required template variables", {
      missingVariables
    });
  }

  return templateText.replace(placeholderPattern, (_, variableName) => {
    return formatTemplateValue(variables[variableName]);
  });
}

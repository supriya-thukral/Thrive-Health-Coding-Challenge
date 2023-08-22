"use strict";

const fs = require("fs");
const Joi = require("joi");

// Reads a JSON file from a given file path and returns the parsed content.
const readJsonFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    console.error(`The file ${filePath} does not exist!`);
    process.exit(1);
  }

  try {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(fileContent);
  } catch (error) {
    console.error(
      `An error occurred while reading or parsing ${filePath}:`,
      error.message
    );
    process.exit(1);
  }
};

// Validates an array of objects against a given schema, and logs errors if validation fails.
const validateArray = (array, schema, entityName) => {
  array.forEach((item, index) => {
    const { error } = schema.validate(item);
    if (error) {
      console.error(
        `Validation error in ${entityName} at index ${index}:`,
        error.message
      );
      process.exit(1);
    }
  });
};

let companies = readJsonFile("./companies.json");
let users = readJsonFile("./users.json");

// Define validation schemas for companies and users.
const companySchema = Joi.object({
  id: Joi.number().required(),
  name: Joi.string().required(),
  top_up: Joi.number().required(),
  email_status: Joi.boolean().required(),
  usersEmailed: Joi.array().items(Joi.object()),
  usersNotEmailed: Joi.array().items(Joi.object()),
});
const userSchema = Joi.object({
  id: Joi.number().required(),
  first_name: Joi.string().required(),
  last_name: Joi.string().required(),
  email: Joi.string().email().required(),
  company_id: Joi.number().required(),
  email_status: Joi.boolean().required(),
  active_status: Joi.boolean().required(),
  tokens: Joi.number().required(),
  company: Joi.object(),
});

// Validate the companies and users arrays against their respective schemas.
validateArray(companies, companySchema, "company");
validateArray(users, userSchema, "user");

console.log("Validation passed for companies and users.");

// Sorting functions for companies and users.
companies.sort((a, b) => a.id - b.id);
users.sort((a, b) => {
  if (a.last_name < b.last_name) return -1;
  if (a.last_name > b.last_name) return 1;
  return 0;
});

// Associating users with their corresponding companies and filtering by active status.
companies.forEach((company) => {
  const usersInCompany = users.filter(
    (user) => user.company_id === company.id && user.active_status
  );
  company.users = usersInCompany;
});

// Updating the company schema to include the users.
const companySchemaWithUsers = Joi.object({
  id: Joi.number().required(),
  name: Joi.string().required(),
  top_up: Joi.number().required(),
  email_status: Joi.boolean().required(),
  users: Joi.array().items(userSchema),
});

// Re-validating the companies after adding the users.
validateArray(companies, companySchemaWithUsers, "company with users");

// Handling user token top-ups based on company information.
companies.forEach((company) => {
  company.users.forEach((user) => {
    if (user.active_status) {
      user.tokens += company.top_up;
    }
  });
});

// Categorizing users based on email status.
users.forEach((user) => {
  const company = companies.find((company) => company.id === user.company_id);
  if (company.email_status && user.email_status && user.active_status) {
    if (!company.usersEmailed) {
      company.usersEmailed = [];
    }
    company.usersEmailed.push(user);
  } else {
    if (!company.usersNotEmailed) {
      company.usersNotEmailed = [];
    }
    if (user.active_status) {
      company.usersNotEmailed.push(user);
    }
  }
});

// Preparing output file.
const outputFilePath = "./output.txt";
fs.writeFileSync(outputFilePath, "");

// Appends given text to the output file.
const appendToOutputFile = (text) => {
  fs.appendFileSync(outputFilePath, text);
};
appendToOutputFile(`\n`);

// Formats and appends company data to the output file.
const outputCompany = (company) => {
  appendToOutputFile(`\tCompany Id: ${company.id}\n`);
  appendToOutputFile(`\tCompany Name: ${company.name}\n`);
  appendToOutputFile(`\tUsers Emailed:\n`);
  company.usersEmailed?.forEach((user) => {
    appendToOutputFile(
      `\t\t${user.last_name}, ${user.first_name}, ${user.email}\n`
    );
    appendToOutputFile(
      `\t\t  Previous Token Balance, ${user.tokens - company.top_up}\n`
    );
    appendToOutputFile(`\t\t  New Token Balance ${user.tokens}\n`);
  });
  appendToOutputFile(`\tUsers Not Emailed:\n`);
  company.usersNotEmailed?.forEach((user) => {
    appendToOutputFile(
      `\t\t${user.last_name}, ${user.first_name}, ${user.email}\n`
    );
    appendToOutputFile(
      `\t\t  Previous Token Balance, ${user.tokens - company.top_up}\n`
    );
    appendToOutputFile(`\t\t  New Token Balance ${user.tokens}\n`);
  });

  appendToOutputFile(
    `\t\tTotal amount of top ups for ${company.name}: ${
      company.top_up * company.users.length
    }\n`
  );
  appendToOutputFile(`\n`);
};

// Outputting the company data for companies with users who were emailed or not.
companies.forEach((company) => {
  if (company.usersEmailed || company.usersNotEmailed) {
    outputCompany(company);
  }
});
console.log(`Output file created at ${outputFilePath}`);

// Verifies if the generated output matches the example output file.
const output = fs.readFileSync(outputFilePath, "utf-8");
const exampleOutput = fs.readFileSync("./example_output.txt", "utf-8");
if (output === exampleOutput) {
  console.log("Output file is correct.");
} else {
  const outputLines = output.split("\n");
  const exampleOutputLines = exampleOutput.split("\n");
  for (let i = 0; i < outputLines.length; i++) {
    if (outputLines[i] !== exampleOutputLines[i]) {
      console.log(`Difference at line ${i + 1}:`);
      console.log(`Output: ${outputLines[i]}`);
      console.log(`Example Output: ${exampleOutputLines[i]}`);
      break;
    }
  }
}

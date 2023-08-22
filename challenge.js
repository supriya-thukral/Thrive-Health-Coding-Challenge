"use strict";

const fs = require("fs");
const Joi = require("joi");

const outputFilePath = "./output.txt";

/**
 * readJsonFile - Reads a JSON file and returns the parsed JSON.
 */
function readJsonFile(filePath) {
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
}

const readCompanies = readJsonFile("./companies.json");
const readUsers = readJsonFile("./users.json");

// Schema definitions for the company and user objects.
const companySchema = Joi.object({
  id: Joi.number().integer().min(1).required(),
  name: Joi.string().required(),
  top_up: Joi.number().integer().min(0).required(),
  email_status: Joi.boolean().required(),
  users: Joi.array().items(Joi.number().integer().min(1)),
  usersEmailed: Joi.array().items(Joi.number().integer().min(1)),
  usersNotEmailed: Joi.array().items(Joi.number().integer().min(1)),
});

const userSchema = Joi.object({
  id: Joi.number().integer().min(1).required(),
  first_name: Joi.string().required(),
  last_name: Joi.string().required(),
  email: Joi.string().email().required(),
  email_status: Joi.boolean().required(),
  active_status: Joi.boolean().required(),
  tokens: Joi.number().integer().min(0).required(),
  company_id: Joi.number().integer().min(1).required(),
});

/**
 * validateSchema - Validates a schema against data.
 * @param {object} schema - The schema to validate against.
 * @param {object} data - The data to validate.
 * @param {string} context - The context of the data.
 */
function validateSchema(schema, data, context) {
  const { error } = schema.validate(data);
  if (error) {
    // Tell the user what the error is and what they might need to do:
    console.error(
      "Invalid data for " +
        context +
        ": " +
        error.message +
        "\n " +
        JSON.stringify(data)
    );
    process.exit(1);
  }
}

/**
 * Company - Represents a company.
 * @param {number} id - The company's id.
 * @param {string} name - The company's name.
 * @param {number} top_up - The company's top up amount.
 * @param {boolean} email_status - The company's email status.
 * @param {array} users - The company's users.
 * @param {array} usersEmailed - The company's users that have been emailed.
 * @param {array} usersNotEmailed - The company's users that have not been emailed.
 * @returns {Company} - A company object.
 * @constructor
 * @throws {Error} - Throws an error if the company object is invalid.
 *
 */
class Company {
  constructor(id, name, top_up, email_status) {
    validateSchema(
      companySchema,
      {
        id,
        name,
        top_up,
        email_status,
      },
      "company"
    );
    this.id = id;
    this.name = name;
    this.top_up = top_up;
    this.email_status = email_status;
    this.users = [];
    this.usersEmailed = [];
    this.usersNotEmailed = [];
  }

  /**
   * addUsers - Adds users to the company.
   * @param {array} users - The users to add to the company.
   * @returns {void}
   */
  addUsers(users) {
    this.users = users;
  }

  /**
   * getUsers - Gets the users in the company.
   * @param {array} users - The users to get from the company.
   * @returns {array} - The users in the company that are active.
   */
  getUsers(users) {
    return users.filter(
      (user) => user.company_id === this.id && user.active_status
    );
  }
}

/**
 * User - Represents a user.
 * @param {number} id - The user's id.
 * @param {string} first_name - The user's first name.
 * @param {string} last_name - The user's last name.
 * @param {string} email - The user's email.
 * @param {boolean} email_status - The user's email status.
 * @param {boolean} active_status - The user's active status.
 * @param {number} tokens - The user's tokens.
 *
 * @returns {User} - A user object.
 * @constructor
 * @throws {Error} - Throws an error if the user object is invalid.
 */
class User {
  constructor(data) {
    validateSchema(userSchema, data, "user with id " + data.id);
    Object.assign(this, data);
  }
}

// Create company and user objects from the data and add users to companies.
const companies = readCompanies.map(
  (company) =>
    new Company(company.id, company.name, company.top_up, company.email_status)
);
const users = readUsers.map((user) => new User(user));

companies.forEach((company) => company.addUsers(users));

/**
 * sortData - Sorts the companies and users by id and last name respectively.
 * @param {array} companies - The companies to sort.
 * @param {array} users - The users to sort.
 */
function sortData(companies, users) {
  companies.sort((a, b) => a.id - b.id);
  users.sort((a, b) =>
    a.last_name < b.last_name ? -1 : a.last_name > b.last_name ? 1 : 0
  );
}

/**
 * processCompaniesAndUsers - Processes the companies and users by adding users to companies,
 * adding users to the usersEmailed and usersNotEmailed arrays, and updating the user's tokens.
 * @param {array} companies - The companies to process.
 * @param {array} users - The users to process.
 * @returns {void}
 */
function processCompaniesAndUsers(companies, users) {
  companies.forEach((company) => {
    const usersInCompany = company.getUsers(users);
    company.users = usersInCompany;
    company.users.forEach((user) => {
      if (user.active_status) {
        user.tokens += company.top_up;
      }
    });
  });

  categorizeUsersByEmailStatus(users, companies);
}

/**
 * categorizeUsersByEmailStatus - Categorizes users by email status.
 * @param {array} users - The users to categorize.
 * @param {array} companies - The list of companies.
 */
function categorizeUsersByEmailStatus(users, companies) {
  users.forEach((user) => {
    const company = companies.find((company) => company.id === user.company_id);
    if (company.email_status && user.email_status && user.active_status) {
      company.usersEmailed.push(user);
    } else if (user.active_status) {
      company.usersNotEmailed.push(user);
    }
  });
}

/**
 * appendToOutputFile - Appends text to the output file.
 * @param {string} text - The text to append to the output file.
 * @returns {void}
 */
function appendToOutputFile(text) {
  fs.appendFileSync(outputFilePath, text);
}

/**
 * outputUser - Outputs a user to the output file.
 * @param {object} user - The user to output.
 * @param {object} company - The company the user belongs to.
 * @returns {void}
 */
function outputUser(user, company) {
  appendToOutputFile(
    `\t\t${user.last_name}, ${user.first_name}, ${user.email}\n`
  );
  appendToOutputFile(
    `\t\t  Previous Token Balance, ${user.tokens - company.top_up}\n`
  );
  appendToOutputFile(`\t\t  New Token Balance ${user.tokens}\n`);
}

/**
 * outputCompany - Outputs a company to the output file.
 * @param {object} company - The company to output.
 * @returns {void}
 */
function outputCompany(company) {
  appendToOutputFile(`\tCompany Id: ${company.id}\n`);
  appendToOutputFile(`\tCompany Name: ${company.name}\n`);
  appendToOutputFile(`\tUsers Emailed:\n`);
  company.usersEmailed?.forEach((user) => {
    outputUser(user, company);
  });
  appendToOutputFile(`\tUsers Not Emailed:\n`);
  company.usersNotEmailed?.forEach((user) => {
    outputUser(user, company);
  });
  appendToOutputFile(
    `\t\tTotal amount of top ups for ${company.name}: ${
      company.top_up * company.users.length
    }\n`
  );
  appendToOutputFile(`\n`);
}

/**
 * outputResults - Outputs the results to the output file.
 * @param {array} companies - The companies to output.
 * @returns {void}
 */
function outputResults(companies) {
  fs.writeFileSync(outputFilePath, "");
  appendToOutputFile(`\n`);
  companies.forEach((company) => {
    if (company.usersEmailed.length > 0 || company.usersNotEmailed.length > 0) {
      outputCompany(company);
    }
  });
  console.log(`Output file created at ${outputFilePath}`);
}

/**
 * verifyOutput - Verifies that the output file is correct.
 * @param {string} outputPath - The path to the output file.
 * @param {string} exampleOutputPath - The path to the example output file.
 * @returns {void}
 */
function verifyOutput(outputPath, exampleOutputPath) {
  const output = fs.readFileSync(outputPath, "utf-8");
  const exampleOutput = fs.readFileSync(exampleOutputPath, "utf-8");
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
}

// Run the program.
try {
  sortData(companies, users);
  processCompaniesAndUsers(companies, users);
  outputResults(companies);
  verifyOutput(outputFilePath, "./example_output.txt");
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

// Tests

// TODO: Optionally install jest and write some tests! For the purposes of this challenge, and in the interest of
// keeping all code within one file, validation functions have been provided for you. You can use these to validate
// the data before creating objects from it.

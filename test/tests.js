'use strict';

const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const test = require('tape-catch');

const appCmd = 'bin/ytoj.js';
const configFile = 'ytoj.json';
let configuration = {};

const setup = function (fixtures) {
  // Default configuration
  configuration = {
    yaml: '',
    json: '',
    schema: 'http://json-schema.org/draft-07/schema#',
    id: 'tel:123-456-7890',
    resolveRefs: false,
    additionalProperties: false,
  };

  // Update configuration with the specific test fixture
  fixtures.forEach(fixture => {
    configuration[fixture.key] = fixture.value;
  });

  // Write configuration
  fs.writeFileSync(configFile, JSON.stringify(configuration));
};

const setup_invalid_config = function () {
  fs.writeFileSync(configFile, 'At vero eos et accusamus et iusto odio dignissimos ducimus');
};

const teardown = function (config) {
  if (config) {
    // Delete the output file, if it exists
    // and remove the output directory
    const output = config.json;

    if (fs.existsSync(output)) {
      fs.unlinkSync(output);

      const outDir = path.dirname(output);

      if (outDir !== '.') {
        fs.rmdirSync(outDir);
      }
    }
  }

  // Delete configuration
  if (fs.existsSync(configFile)) {
    fs.unlinkSync(configFile);
  }
};

// Make sure the teardown happens even if there's an exception in the test
// (caught by tape-catch and reported as test failure)
// "Normal" failures should result in teardown at the end of the test anyway
test.onFailure(teardown);

test('Invalid Configuration', function (t) {
  t.plan(1);

  setup_invalid_config();

  // Expect with colors!
  const expected = '\x1b[31mCould not get configuration:';

  // Start our app as a child process
  cp.execFile('node', [appCmd], (error, childOut, childErr) => {
    if (error) {
      throw error; // Something really unexpected happened
    }

    const actual = childErr.toString();
    t.equal(actual.startsWith(expected), true, 'Should see error when configuration file is invalid.');

    teardown();
  });
});

test('Non-existent YAML File', function (t) {
  t.plan(1);

  const existMeNot = 'never.yaml';

  setup([{ key: 'yaml', value: existMeNot }]);

  // Expect with colors!
  const expected = `\u001b[31mCould not get configuration: Error: \u001b[31mInput file ${existMeNot} is not found.\u001b[39m[39m\n`;

  // Start our app as a child process
  cp.execFile('node', [appCmd], (error, childOut, childErr) => {
    if (error) {
      throw error; // Something really unexpected happened
    }

    const actual = childErr.toString();
    t.equal(actual, expected, 'Should see error when YAML file does not exist.');

    teardown();
  });
});

test('Output to Current Working Directory', function (t) {
  t.plan(2);

  const input = 'sample/petstore-simple.yaml';
  const output = 'here.json';

  setup([
    { key: 'yaml', value: input },
    { key: 'json', value: output },
  ]);

  // Start our app as a child process
  cp.execFile('node', [appCmd], (error, childOut, childErr) => {
    if (error) {
      throw error; // Something really unexpected happened
    }

    // Verify that no errors reported by ytoj
    t.equals(childErr, '', 'There should not be any errors reported by the program.');

    // Verify that the output path exists
    t.equals(fs.existsSync(output), true, 'Output file should have been created.');

    teardown(configuration);
  });
});

test('Non-existent Output Path', function (t) {
  t.plan(3);

  const input = 'sample/petstore-simple.yaml';
  const output = 'never/never.json';

  setup([
    { key: 'yaml', value: input },
    { key: 'json', value: output },
  ]);

  // Verify that the output path does not yet exist
  t.equals(fs.existsSync(output), false, 'Output directory should not yet exist.');

  // Start our app as a child process
  cp.execFile('node', [appCmd], (error, childOut, childErr) => {
    if (error) {
      throw error; // Something really unexpected happened
    }

    // Verify that no errors reported by ytoj
    t.equals(childErr, '', 'There should not be any errors reported by the program.');

    // Verify that the output path exists
    t.equals(fs.existsSync(output), true, 'Output directory and file should have been created.');

    teardown(configuration);
  });
});


test('Existing Output File', function (t) {
  t.plan(2);

  const originalContent = 'Lorem ipsum dolor sit amet';
  const input = 'sample/petstore-simple.yaml';
  const output = 'out/ever.json';

  setup([
    { key: 'yaml', value: input },
    { key: 'json', value: output },
  ]);

  // Create dummy output file
  fs.mkdirSync(path.dirname(output));
  fs.writeFileSync(output, originalContent);

  // Start our app as a child process
  cp.execFile('node', [appCmd], (error, childOut, childErr) => {
    if (error) {
      throw error; // Something really unexpected happened
    }

    // Verify that no errors reported by ytoj
    t.equals(childErr, '', 'There should not be any errors reported by the program.');

    // Verify that the output file got overwritten
    const newContent = fs.readFileSync(output);
    t.notEquals(originalContent, newContent, 'Output file should have been overwritten.');

    teardown(configuration);
  });
});

test('Invalid $schema', function (t) {
  t.plan(1);

  const input = 'sample/petstore-simple.yaml';
  const output = 'out/nofile.json';

  setup([
    { key: 'yaml', value: input },
    { key: 'json', value: output },
    { key: 'schema', value: 'http://www.example.com' },
  ]);

  // Start our app as a child process
  cp.execFile('node', [appCmd], (error, childOut, childErr) => {
    if (error) {
      throw error; // Something really unexpected happened
    }

    const expected = 'Invalid $schema';
    const actual = childErr.toString();
    t.equal(actual.includes(expected), true, 'Should see error when specified $schema is invalid.');

    teardown(configuration);
  });
});

test('Invalid $id', function (t) {
  t.plan(1);

  const input = 'sample/petstore-simple.yaml';
  const output = 'out/nofile.json';

  setup([
    { key: 'yaml', value: input },
    { key: 'json', value: output },
    { key: 'id', value: 'not.a.uri' },
  ]);

  // Start our app as a child process
  cp.execFile('node', [appCmd], (error, childOut, childErr) => {
    if (error) {
      throw error; // Something really unexpected happened
    }

    const expected = 'Invalid URL';
    const actual = childErr.toString();
    t.equal(actual.includes(expected), true, 'Should see error when specified $id is not a valid URI.');

    teardown(configuration);
  });
});

test('Generate Schema', function (t) {
  t.plan(2);

  const input = 'sample/petstore-simple.yaml';
  const output = 'out/petstore-simple-generated.json';
  const id = 'https://github.com/tromgy/swagger-yaml-to-json-schema';

  setup([
    { key: 'yaml', value: input },
    { key: 'json', value: output },
    { key: 'id', value: id },
  ]);

  // Start our app as a child process
  cp.execFile('node', [appCmd], (error, childOut, childErr) => {
    if (error) {
      throw error; // Something really unexpected happened
    }

    const expected = '';
    const actual = childErr.toString();
    t.equal(actual, expected, 'Should see no errors.');

    // Compare generated schema to known "good" schema validated by https://www.jsonschemavalidator.net
    const standardSchema = JSON.parse(fs.readFileSync('sample/petstore-simple-schema.json'));
    const generatedSchema = JSON.parse(fs.readFileSync(output));
    t.deepEqual(generatedSchema, standardSchema, 'Generated schema should be the same as known "good" schema.');

    teardown(configuration);
  });
});

test('Generate Schema: additionalProperties === true', function (t) {
  t.plan(2);

  const input = 'sample/petstore-simple.yaml';
  const output = 'out/petstore-simple-generated.json';
  const id = 'https://github.com/tromgy/swagger-yaml-to-json-schema';

  setup([
    { key: 'yaml', value: input },
    { key: 'json', value: output },
    { key: 'id', value: id },
    { key: 'additionalProperties', value: true },
  ]);

  // Start our app as a child process
  cp.execFile('node', [appCmd], (error, childOut, childErr) => {
    if (error) {
      throw error; // Something really unexpected happened
    }

    const expected = '';
    const actual = childErr.toString();
    t.equal(actual, expected, 'Should see no errors.');

    const generatedSchema = JSON.parse(fs.readFileSync(output));
    t.equal(generatedSchema.additionalProperties, true, 'Generated schema should allow additional properties.');

    teardown(configuration);
  });
});

test('Generate Schema: resolve $refs', function (t) {
  t.plan(2);

  const input = 'sample/petstore-simple.yaml';
  const output = 'out/petstore-simple-generated.json';
  const id = 'https://github.com/tromgy/swagger-yaml-to-json-schema';

  setup([
    { key: 'yaml', value: input },
    { key: 'json', value: output },
    { key: 'id', value: id },
    { key: 'resolveRefs', value: true },
  ]);

  // Start our app as a child process
  cp.execFile('node', [appCmd], (error, childOut, childErr) => {
    if (error) {
      throw error; // Something really unexpected happened
    }

    const expected = '';
    const actual = childErr.toString();
    t.equal(actual, expected, 'Should see no errors.');

    const generatedData = fs.readFileSync(output);

    t.equal(generatedData.includes('$ref'), false, 'Generated schema should have no $refs.');

    teardown(configuration);
  });
});
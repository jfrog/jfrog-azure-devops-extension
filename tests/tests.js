'use strict';

const assert = require('assert');
const path = require('path');
const vstsMockTest = require('vsts-task-lib/mock-test');
const fs = require('fs');
const testUtils = require('./testUtils');

let tasksDir = path.join(__dirname, "tasks");
let tasks = fs.readdirSync(tasksDir);

describe('JFrog Artifactory VSTS extension tests', () => {
    before(() => {
        testUtils.cleanUp();
        testUtils.createTestDataDir();
    });

    after(() => {
        testUtils.cleanUp();
    });
    for (let i = 0; i < tasks.length; i++) {
        let taskName = tasks[i];
        describe(taskName + ' Positive', () => {
            let testsDir = path.join(tasksDir, taskName, "positive");
            if (fs.existsSync(testsDir)) {
                let tests = fs.readdirSync(testsDir);
                for (let i = 0; i < tests.length; i++) {
                    runTest(taskName, tests[i], true);
                }
            }
        });

        describe(taskName + ' Negative', () => {
            let testsDir = path.join(tasksDir, taskName, "negative");
            if (fs.existsSync(testsDir)) {
                let tests = fs.readdirSync(testsDir);
                for (let i = 0; i < tests.length; i++) {
                    runTest(taskName, tests[i], false);
                }
            }
        });
    }
});


function runTest(taskName, testName, positive) {
    it(testName, (done) => {
        let testDir = path.join(tasksDir, taskName, positive ? "positive" : "negative", testName);
        let testPath = path.join(testDir, "test.js");
        let mockRunner = new vstsMockTest.MockTestRunner(testPath);
        mockRunner.run();
        assert(positive ? mockRunner.succeeded : mockRunner.failed, mockRunner.stdout);
        if (positive) {
            assertFiles(testDir, testName);
        }
        done();
    }).timeout(100000);
}

function assertFiles(testDir, testName) {
    let filesToCheck = [];
    let filesDir = path.join(testDir, "files");
    let testData = path.join(testUtils.testDataDir, testName);
    if (fs.existsSync(filesDir)) {
        let files = fs.readdirSync(filesDir);
        for (let i = 0; i < files.length; i++) {
            let fileName = path.basename(files[i]);
            let fileToCheck = path.join(testData, fileName);
            assert(fs.existsSync(fileToCheck), fileToCheck + " does not exist");
            filesToCheck.push(fileName);
        }
    }
    if (!fs.existsSync(testData) && filesToCheck.length === 0) {
        return;
    }
    let files = fs.readdirSync(testData);
    for (let i = 0; i < files.length; i++) {
        let fileName = path.basename(files[i]);
        assert(filesToCheck.indexOf(fileName) >= 0, fileName + " should not exist");
    }
}

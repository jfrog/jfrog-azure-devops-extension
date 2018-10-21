const tl = require('vsts-task-lib/task');
const taskUtils = require('./taskUtils');
const CliCommandBuilder = require('./cliCommandBuilder').CliCommandBuilder;
const path = require('path');

const CONFIGURATION = {
    'DOWNLOAD': {
        COMMAND: "rt dl",
        SPEC_NAME: "downloadSpec"
    },
    'UPLOAD': {
        COMMAND: "rt u",
        SPEC_NAME: "uploadSpec"
    }
};

class GenericTaskExecutor {

    constructor(configuration, cliPath) {
        this.command = configuration.COMMAND;
        this.specName = configuration.SPEC_NAME;
        this.cliPath = cliPath;
    }

    run() {
        let workDir = tl.getVariable('System.DefaultWorkingDirectory');
        if (!workDir) {
            throw new Error("Failed getting default working directory.");
        }

        let specPath = path.join(workDir, this.specName + Date.now() + ".json");
        try {
            taskUtils.prepareFileSpec(specPath);
        } catch (e) {
            throw new Error("FileSpec parsing failed: " + e);
        }

        let command = new CliCommandBuilder(this.cliPath)
            .addCommand(this.command)
            .addOption("spec", specPath)
            .addArtifactoryServerWithCredentials("artifactoryService")
            .addBoolOptionFromParam("failNoOp", "fail-no-op")
            .addBuildFlagsIfRequired();

        taskUtils.executeCliCommand(command.build(), workDir);
        try {
            // Remove created fileSpec from file system
            tl.rmRF(specPath);
        } catch (ex) {
            throw new Error("Failed cleaning temporary FileSpec file: " + ex);
        }
        tl.setResult(tl.TaskResult.Succeeded, "Build Succeeded.");
    }
}

module.exports = {
    GenericTaskExecutor,
    GENERIC_TASK_CONFIGURATION: CONFIGURATION
};
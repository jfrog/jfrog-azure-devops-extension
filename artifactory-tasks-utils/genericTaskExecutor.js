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
            tl.setResult(tl.TaskResult.Failed, "Failed getting default working directory.");
            return;
        }

        let specPath = path.join(workDir, this.specName + Date.now() + ".json");
        let error = taskUtils.prepareFileSpec(specPath);
        if (error) {
            return;
        }

        let command = new CliCommandBuilder(this.cliPath)
            .addCommand(this.command)
            .addOption("spec", specPath)
            .addArtifactoryServerWithCredentials("artifactoryService")
            .addBoolOptionFromParam("failNoOp", "fail-no-op")
            .addBuildFlagsIfRequired();

        let taskRes = taskUtils.executeCliCommand(command.build(), workDir);
        // Remove created fileSpec from file system
        try {
            tl.rmRF(specPath);
        } catch (ex) {
            taskRes = "Failed cleaning temporary FileSpec file.";
            tl.setResult(tl.TaskResult.Failed, taskRes);
        }

        if (taskRes) {
            return;
        }
        tl.setResult(tl.TaskResult.Succeeded, "Build Succeeded.");
    }
}

module.exports = {
    GenericTaskExecutor,
    GENERIC_TASK_CONFIGURATION: CONFIGURATION
};
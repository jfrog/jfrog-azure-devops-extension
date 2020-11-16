// @ts-ignore
import * as utils from "artifactory-tasks-utils";
// @ts-ignore
import * as tl from "azure-pipelines-task-lib/task";


const cliPipInstallCommand:string = "rt pip-install";
const pipConfigCommand:string = "rt pip-config";
const disablePipCacheFlags:string = "--no-cache-dir --force-reinstall";



function RunTaskCbk(cliPath:string):void {
    let pipCommand = tl.getInput("command", true);
    switch (pipCommand) {
        case "install":
            performPipInstall(cliPath);
            break;
    }
}

function performPipInstall(cliPath:string) {
    let inputWorkingDirectory = tl.getInput("workingDirectory", false);
    let defaultWorkDir = tl.getVariable("System.DefaultWorkingDirectory") || process.cwd();
    let sourcePath = utils.determineCliWorkDir(defaultWorkDir, inputWorkingDirectory);
    let configuredServerId = performPipConfig(cliPath, sourcePath);
    let pipArguments = buildPipCliArgs();
    let pipCommand = utils.cliJoin(cliPath, cliPipInstallCommand, pipArguments);
    let virtualEnvActivation = tl.getInput("virtualEnvActivation", false);
    if(virtualEnvActivation){
        pipCommand = utils.cliJoin(virtualEnvActivation, "&&", pipCommand)
    }
    executeCliCommand(pipCommand, sourcePath, cliPath, configuredServerId);

}

function executeCliCommand(cliCmd:string, buildDir:string, cliPath:string, configuredServerId:string) {
    let collectBuildInfo = tl.getBoolInput("collectBuildInfo");
    if (collectBuildInfo) {
        let buildName = tl.getInput("buildName", true);
        let buildNumber = tl.getInput("buildNumber", true);
        cliCmd = utils.cliJoin(cliCmd, "--build-name=" + utils.quote(buildName), "--build-number=" + utils.quote(buildNumber));
    }
    try {
        utils.executeCliCommand(cliCmd, buildDir, null);
        tl.setResult(tl.TaskResult.Succeeded, "Build Succeeded.");
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
    } finally {
        if (configuredServerId) {
            utils.deleteCliServers(cliPath, buildDir, configuredServerId);
        }
    }
}

// Create Python pip configuration
function performPipConfig(cliPath:string, requiredWorkDir:string) : string {
    return utils.createBuildToolConfigFile(
        cliPath,
        "artifactoryService",
        "pip",
        requiredWorkDir,
        pipConfigCommand,
        "targetResolveRepo",
        null
    );
}

// Creates the Python CLI arguments
function buildPipCliArgs(): string {
    let pipArguments = tl.getInput("arguments") || "";
    let noCache = tl.getBoolInput("noPipCache");
    if (noCache) {
        pipArguments = utils.cliJoin(pipArguments, disablePipCacheFlags);
    }
    return pipArguments;
}

utils.executeCliTask(RunTaskCbk);

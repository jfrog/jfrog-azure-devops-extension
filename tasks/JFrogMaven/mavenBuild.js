"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const tl = __importStar(require("azure-pipelines-task-lib/task"));
const utils = __importStar(require("@jfrog/tasks-utils/utils.js"));
const cliMavenCommand = 'mvn';
const mavenConfigCommand = 'mvnc';
let serverIdDeployer;
let serverIdResolver;
utils.executeCliTask(RunTaskCbk);
async function RunTaskCbk(cliPath) {
    var _a, _b, _c;
    utils.setJdkHomeForJavaTasks();
    checkAndSetMavenHome();
    const workDir = tl.getVariable('System.DefaultWorkingDirectory');
    if (!workDir) {
        tl.setResult(tl.TaskResult.Failed, 'Failed getting default working directory.');
        return;
    }
    // Create Maven config file.
    try {
        await createMavenConfigFile(cliPath, workDir);
    }
    catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
        cleanup(cliPath, workDir);
        return;
    }
    // Running Maven command
    const pomFile = (_a = tl.getInput('mavenPOMFile')) !== null && _a !== void 0 ? _a : '';
    let goalsAndOptions = (_b = tl.getInput('goals')) !== null && _b !== void 0 ? _b : '';
    goalsAndOptions = utils.cliJoin(goalsAndOptions, '-f', utils.quote(pomFile));
    const options = (_c = tl.getInput('options')) !== null && _c !== void 0 ? _c : '';
    if (options) {
        goalsAndOptions = utils.cliJoin(goalsAndOptions, options);
    }
    let mavenCommand = utils.cliJoin(cliPath, cliMavenCommand, goalsAndOptions);
    mavenCommand = utils.appendBuildFlagsToCliCommand(mavenCommand);
    try {
        utils.executeCliCommand(mavenCommand, workDir);
    }
    catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
    }
    finally {
        cleanup(cliPath, workDir);
    }
    // Ignored if the build's result was previously set to 'Failed'.
    tl.setResult(tl.TaskResult.Succeeded, 'Build Succeeded.');
}
function checkAndSetMavenHome() {
    const m2HomeEnvVar = tl.getVariable('M2_HOME');
    if (!m2HomeEnvVar) {
        console.log('M2_HOME is not defined. Retrieving Maven home using mvn --version.');
        // The M2_HOME environment variable is not defined.
        // Since Maven installation can be located in different locations,
        // depending on the installation type and the OS (for example: For Mac with brew install: /usr/local/Cellar/maven/{version}/libexec or Ubuntu with debian: /usr/share/maven),
        // we need to grab the location using the mvn --version command
        // Setup tool runner that executes Maven only to retrieve its version
        const mvnExec = tl.which('mvn', true);
        const res = tl.tool(mvnExec).arg('-version').execSync().stdout.trim();
        const mavenHomeLine = res.split('\n')[1].trim();
        const regexMatch = mavenHomeLine.match('^Maven\\shome:\\s(.+)');
        if (regexMatch) {
            const mavenHomePath = regexMatch[1];
            console.log('The Maven home location: ' + mavenHomePath);
            process.env['M2_HOME'] = mavenHomePath;
        }
        else {
            console.log('Couldn\'t retrieve Maven home path using "mvn --version" command. Received output: ' + res);
        }
    }
}
function createMavenConfigFile(cliPath, buildDir) {
    var _a;
    let cliCommand = utils.cliJoin(cliPath, mavenConfigCommand);
    // Configure resolver server, throws on failure.
    const artifactoryResolver = tl.getInput('artifactoryResolverService');
    if (artifactoryResolver) {
        serverIdResolver = utils.assembleUniqueServerId('maven_resolver');
        await utils.configureArtifactoryCliServer(artifactoryResolver, serverIdResolver, cliPath, buildDir);
        cliCommand = utils.cliJoin(cliCommand, '--server-id-resolve=' + utils.quote(serverIdResolver));
        cliCommand = utils.addStringParam(cliCommand, 'targetResolveReleaseRepo', 'repo-resolve-releases', true);
        cliCommand = utils.addStringParam(cliCommand, 'targetResolveSnapshotRepo', 'repo-resolve-snapshots', true);
    }
    else {
        console.log('Resolution from Artifactory is not configured');
    }
    // Configure deployer server, skip if missing. This allows user to resolve dependencies from artifactory without deployment.
    const artifactoryDeployer = (_a = tl.getInput('artifactoryDeployService')) !== null && _a !== void 0 ? _a : '';
    if (artifactoryDeployer) {
        serverIdDeployer = utils.assembleUniqueServerId('maven_deployer');
        await utils.configureArtifactoryCliServer(artifactoryDeployer, serverIdDeployer, cliPath, buildDir);
        cliCommand = utils.cliJoin(cliCommand, '--server-id-deploy=' + utils.quote(serverIdDeployer));
        cliCommand = utils.addStringParam(cliCommand, 'targetDeployReleaseRepo', 'repo-deploy-releases', true);
        cliCommand = utils.addStringParam(cliCommand, 'targetDeploySnapshotRepo', 'repo-deploy-snapshots', true);
        const filterDeployedArtifacts = tl.getBoolInput('filterDeployedArtifacts');
        if (filterDeployedArtifacts) {
            cliCommand = utils.addStringParam(cliCommand, 'includePatterns', 'include-patterns', false);
            cliCommand = utils.addStringParam(cliCommand, 'excludePatterns', 'exclude-patterns', false);
        }
    }
    else {
        console.info('Deployment skipped since artifactoryDeployService was not set.');
    }
    // Execute cli.
    try {
        utils.executeCliCommand(cliCommand, buildDir);
    }
    catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex);
    }
}
function cleanup(cliPath, workDir) {
    // Delete servers.
    utils.taskDefaultCleanup(cliPath, workDir, [serverIdDeployer, serverIdResolver]);
    // Remove extractor variables.
    try {
        utils.removeExtractorsDownloadVariables(cliPath, workDir);
    }
    catch (removeVariablesException) {
        tl.setResult(tl.TaskResult.Failed, removeVariablesException);
    }
}
//# sourceMappingURL=mavenBuild.js.map
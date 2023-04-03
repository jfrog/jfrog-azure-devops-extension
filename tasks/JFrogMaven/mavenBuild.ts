import * as tl from 'azure-pipelines-task-lib/task';
import * as utils from '@jfrog/tasks-utils/utils.js';
import * as javaCommons from 'azure-pipelines-tasks-java-common/java-common';
import { execSync, ExecSyncOptionsWithStringEncoding } from 'child_process';

const cliMavenCommand: string = 'mvn';
const mavenConfigCommand: string = 'mvnc';
let serverIdDeployer: string;
let serverIdResolver: string;

utils.executeCliTask(RunTaskCbk);

function RunTaskCbk(cliPath: string): void {
    setJdkHome();
    checkAndSetMavenHome();
    let workDir: string | undefined = tl.getVariable('System.DefaultWorkingDirectory');
    if (!workDir) {
        tl.setResult(tl.TaskResult.Failed, 'Failed getting default working directory.');
        return;
    }

    // Create Maven config file.
    try {
        createMavenConfigFile(cliPath, workDir);
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex as string);
        cleanup(cliPath, workDir);
        return;
    }

    // Running Maven command
    let pomFile: string | undefined = tl.getInput('mavenPOMFile') || '';
    let goalsAndOptions: string | undefined = tl.getInput('goals') || '';
    goalsAndOptions = utils.cliJoin(goalsAndOptions, '-f', pomFile);
    let options: string = tl.getInput('options') || '';
    if (options) {
        goalsAndOptions = utils.cliJoin(goalsAndOptions, options);
    }
    let mavenCommand: string = utils.cliJoin(cliPath, cliMavenCommand, goalsAndOptions);
    mavenCommand = utils.appendBuildFlagsToCliCommand(mavenCommand);
    try {
        utils.executeCliCommand(mavenCommand, workDir);
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex as string);
    } finally {
        cleanup(cliPath, workDir);
    }
    // Ignored if the build's result was previously set to 'Failed'.
    tl.setResult(tl.TaskResult.Succeeded, 'Build Succeeded.');
}

function setJdkHome(): void {
    let javaHomeSelection: string | undefined = tl.getInput('javaHomeSelection', true);
    let javaHome: string | undefined;
    if (javaHomeSelection == 'JDKVersion') {
        // Set JAVA_HOME to the specified JDK version (default, 1.7, 1.8, etc.)
        tl.debug('Using the specified JDK version to find and set JAVA_HOME');
        let jdkVersion: string = tl.getInput('jdkVersion') || '';
        let jdkArchitecture: string = tl.getInput('jdkArchitecture') || '';
        if (jdkVersion != 'default') {
            javaHome = javaCommons.findJavaHome(jdkVersion, jdkArchitecture);
        }
    } else {
        // Set JAVA_HOME to the path specified by the user
        tl.debug('Setting JAVA_HOME to the path specified by user input');
        javaHome = tl.getPathInput('jdkUserInputPath', true, true);
    }

    // Set JAVA_HOME as determined above (if different from default)
    if (javaHome) {
        console.log('The Java home location: ' + javaHome);
        tl.setVariable('JAVA_HOME', javaHome);
    }
}

function checkAndSetMavenHome(): void {
    let m2HomeEnvVar: string | undefined = tl.getVariable('M2_HOME');
    if (!m2HomeEnvVar) {
        console.log('M2_HOME is not defined. Retrieving Maven home using mvn --version.');
        // The M2_HOME environment variable is not defined.
        // Since Maven installation can be located in different locations,
        // depending on the installation type and the OS (for example: For Mac with brew install: /usr/local/Cellar/maven/{version}/libexec or Ubuntu with debian: /usr/share/maven),
        // we need to grab the location using the mvn --version command
        let mvnCommand: string = 'mvn --version';
        let res: string = execSync(mvnCommand, { encoding: 'utf-8' } as ExecSyncOptionsWithStringEncoding);
        let mavenHomeLine: string = res.split('\n')[1].trim();
        let mavenHome: string = mavenHomeLine.split(' ')[2];
        console.log('The Maven home location: ' + mavenHome);
        process.env['M2_HOME'] = mavenHome;
    }
}

function createMavenConfigFile(cliPath: string, buildDir: string) {
    let cliCommand: string = utils.cliJoin(cliPath, mavenConfigCommand);

    // Configure resolver server, throws on failure.
    let artifactoryResolver: string | undefined = tl.getInput('artifactoryResolverService');
    if (artifactoryResolver) {
        serverIdResolver = utils.assembleUniqueServerId('maven_resolver');
        utils.configureArtifactoryCliServer(artifactoryResolver, serverIdResolver, cliPath, buildDir);
        cliCommand = utils.cliJoin(cliCommand, '--server-id-resolve=' + utils.quote(serverIdResolver));
        cliCommand = utils.addStringParam(cliCommand, 'targetResolveReleaseRepo', 'repo-resolve-releases', true);
        cliCommand = utils.addStringParam(cliCommand, 'targetResolveSnapshotRepo', 'repo-resolve-snapshots', true);
    } else {
        console.log('Resolution from Artifactory is not configured');
    }

    // Configure deployer server, skip if missing. This allows user to resolve dependencies from artifactory without deployment.
    let artifactoryDeployer: string = tl.getInput('artifactoryDeployService') || '';
    if (artifactoryDeployer) {
        serverIdDeployer = utils.assembleUniqueServerId('maven_deployer');
        utils.configureArtifactoryCliServer(artifactoryDeployer, serverIdDeployer, cliPath, buildDir);
        cliCommand = utils.cliJoin(cliCommand, '--server-id-deploy=' + utils.quote(serverIdDeployer));
        cliCommand = utils.addStringParam(cliCommand, 'targetDeployReleaseRepo', 'repo-deploy-releases', true);
        cliCommand = utils.addStringParam(cliCommand, 'targetDeploySnapshotRepo', 'repo-deploy-snapshots', true);
        let filterDeployedArtifacts: boolean | undefined = tl.getBoolInput('filterDeployedArtifacts');
        if (filterDeployedArtifacts) {
            cliCommand = utils.addStringParam(cliCommand, 'includePatterns', 'include-patterns', false);
            cliCommand = utils.addStringParam(cliCommand, 'excludePatterns', 'exclude-patterns', false);
        }
    } else {
        console.info('Deployment skipped since artifactoryDeployService was not set.');
    }
    // Execute cli.
    try {
        utils.executeCliCommand(cliCommand, buildDir);
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex as string);
    }
}

function cleanup(cliPath: string, workDir: string): void {
    // Delete servers.
    utils.taskDefaultCleanup(cliPath, workDir, [serverIdDeployer, serverIdResolver]);
    // Remove extractor variables.
    try {
        utils.removeExtractorsDownloadVariables(cliPath, workDir);
    } catch (removeVariablesException) {
        tl.setResult(tl.TaskResult.Failed, removeVariablesException as string);
    }
}

import * as utils from '@jfrog/tasks-utils';
import * as tl from 'azure-pipelines-task-lib/task';

const cliEvdCommand: string = 'evd create-evidence';
let serverId: string;

async function RunTaskCbk(cliPath: string): Promise<void> {
    const inputWorkingDirectory: string = tl.getInput('workingDirectory', false) ?? '';
    const defaultWorkDir: string = tl.getVariable('System.DefaultWorkingDirectory') ?? process.cwd();
    const sourcePath: string = utils.determineCliWorkDir(defaultWorkDir, inputWorkingDirectory);

    serverId = await utils.configureDefaultArtifactoryServer('artifactory', cliPath, sourcePath);

    let evdCommand: string = utils.cliJoin(cliPath, cliEvdCommand);
    evdCommand = utils.addServerIdOption(evdCommand, serverId);

    evdCommand = addPredicateOptions(evdCommand);
    evdCommand = addSigningOptions(evdCommand);
    evdCommand = addSubjectOptions(evdCommand);
    evdCommand = addAttachmentOptions(evdCommand);

    evdCommand = utils.addStringParam(evdCommand, 'providerId', 'provider-id', false);
    evdCommand = utils.addStringParam(evdCommand, 'evidenceType', 'type', false);
    evdCommand = utils.addProjectOption(evdCommand);

    const format: string = tl.getInput('format', false) ?? '';
    if (format && format !== 'none') {
        evdCommand = utils.cliJoin(evdCommand, '--format=' + format);
    }

    // Add integration for automatic Predicate generation.
    const integration: string = tl.getInput('integration', false) ?? '';
    switch (integration) {
        // Having a dash (-) in a param name in a visible rule is failing verification on Azure Server (TFS).
        // For that reason we do not use a dash in repo-path, and handle this param separately (not passing the option blindly to the CLI).
        case 'sonar':
            evdCommand = utils.cliJoin(evdCommand, '--integration=' + integration);
            break;
        default:
            break;
    }

    executeCliCommand(evdCommand, sourcePath, cliPath);
}

function addPredicateOptions(cliCommand: string): string {
    const predicatePath: string = tl.getPathInput('predicateFilePath', false, true) ?? '';
    if (predicatePath) {
        cliCommand = utils.cliJoin(cliCommand, '--predicate=' + utils.quote(predicatePath));
    }
    cliCommand = utils.addStringParam(cliCommand, 'predicateType', 'predicate-type', false);

    const markdownPath: string = tl.getPathInput('markdownFilePath', false, true) ?? '';
    if (markdownPath) {
        cliCommand = utils.cliJoin(cliCommand, '--markdown=' + utils.quote(markdownPath));
    }
    return cliCommand;
}

function addSigningOptions(cliCommand: string): string {
    const sigstoreBundlePath: string = tl.getPathInput('sigstoreBundle', false, true) ?? '';
    if (sigstoreBundlePath) {
        cliCommand = utils.cliJoin(cliCommand, '--sigstore-bundle=' + utils.quote(sigstoreBundlePath));
    }

    const keyPath: string = tl.getPathInput('keyFilePath', false, true) ?? '';
    if (keyPath) {
        cliCommand = utils.cliJoin(cliCommand, '--key=' + utils.quote(keyPath));
    }
    cliCommand = utils.addStringParam(cliCommand, 'keyAlias', 'key-alias', false);
    return cliCommand;
}

function addSubjectOptions(cliCommand: string): string {
    const subjectType: string = tl.getInput('subjectType', false) ?? 'none';
    switch (subjectType) {
        case 'build':
            cliCommand = utils.addStringParam(cliCommand, 'buildName', 'build-name', true);
            cliCommand = utils.addStringParam(cliCommand, 'buildNumber', 'build-number', true);
            break;
        case 'releaseBundle':
            cliCommand = utils.addStringParam(cliCommand, 'releaseBundleName', 'release-bundle', true);
            cliCommand = utils.addStringParam(cliCommand, 'releaseBundleVersion', 'release-bundle-version', true);
            break;
        case 'package':
            cliCommand = utils.addStringParam(cliCommand, 'packageName', 'package-name', true);
            cliCommand = utils.addStringParam(cliCommand, 'packageRepoName', 'package-repo-name', true);
            cliCommand = utils.addStringParam(cliCommand, 'packageVersion', 'package-version', true);
            break;
        case 'application':
            cliCommand = utils.addStringParam(cliCommand, 'applicationKey', 'application-key', true);
            cliCommand = utils.addStringParam(cliCommand, 'applicationVersion', 'application-version', true);
            break;
        case 'path':
            cliCommand = utils.addStringParam(cliCommand, 'subjectRepoPath', 'subject-repo-path', true);
            cliCommand = utils.addStringParam(cliCommand, 'subjectSha256', 'subject-sha256', false);
            break;
        default:
            break;
    }
    return cliCommand;
}

function addAttachmentOptions(cliCommand: string): string {
    const attachmentSource: string = tl.getInput('attachmentSource', false) ?? 'none';
    switch (attachmentSource) {
        case 'local': {
            const attachLocalPath: string = tl.getPathInput('attachLocalFilePath', true, true) ?? '';
            cliCommand = utils.cliJoin(cliCommand, '--attach-local=' + utils.quote(attachLocalPath));
            cliCommand = utils.addStringParam(cliCommand, 'attachArtifactoryTempPath', 'attach-artifactory-temp-path', false);
            break;
        }
        case 'artifactory':
            cliCommand = utils.addStringParam(cliCommand, 'attachArtifactoryPath', 'attach-artifactory-path', true);
            break;
        default:
            break;
    }
    return cliCommand;
}

function executeCliCommand(cliCmd: string, buildDir: string, cliPath: string): void {
    try {
        utils.executeCliCommand(cliCmd, buildDir);
        tl.setResult(tl.TaskResult.Succeeded, 'Evidence created successfully.');
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex as string);
    } finally {
        utils.taskDefaultCleanup(cliPath, buildDir, [serverId]);
    }
}

utils.executeCliTask(RunTaskCbk);

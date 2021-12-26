import * as utils from '@jfrog/tasks-utils';
import * as tl from 'azure-pipelines-task-lib/task';
import * as path from 'path';

const cliRbcCommand: string = 'ds rbc';
const cliRbuCommand: string = 'ds rbu';
const cliRbsCommand: string = 'ds rbs';
const cliRbdCommand: string = 'ds rbd';
const cliRbdelCommand: string = 'ds rbdel';
let serverId: string;

function RunTaskCbk(cliPath: string): void {
    const workDir: string = getWorkDir();
    const rbCommand: string = tl.getInput('command', true) || '';
    switch (rbCommand) {
        case 'create':
            performRbCreate(cliPath, workDir);
            break;
        case 'update':
            performRbUpdate(cliPath, workDir);
            break;
        case 'sign':
            performRbSign(cliPath, workDir);
            break;
        case 'distribute':
            performRbDistribute(cliPath, workDir);
            break;
        case 'delete':
            performRbDelete(cliPath, workDir);
            break;
    }
}

function performRbCreate(cliPath: string, workDir: string): void {
    performRbCreateUpdate(cliPath, workDir, cliRbcCommand);
}

function performRbUpdate(cliPath: string, workDir: string): void {
    performRbCreateUpdate(cliPath, workDir, cliRbuCommand);
}

function performRbCreateUpdate(cliPath: string, workDir: string, cliCommandName: string): void {
    let cliCommand: string = getCliCmdBase(cliPath, cliCommandName, workDir);

    const specPath: string = path.join(workDir, 'rbSpec' + Date.now() + '.json');
    cliCommand = utils.handleSpecFile(cliCommand, specPath);

    const autoSign: boolean = tl.getBoolInput('autoSign', false);
    if (autoSign) {
        cliCommand = utils.cliJoin(cliCommand, '--sign');
        cliCommand = utils.addStringParam(cliCommand, 'passphrase', 'passphrase', false);
    }

    const useCustomRepo: boolean = tl.getBoolInput('useCustomRepo', false);
    if (useCustomRepo) {
        cliCommand = utils.addStringParam(cliCommand, 'customRepoName', 'repo', true);
    }

    const addReleaseNotes: boolean = tl.getBoolInput('addReleaseNotes', false);
    if (addReleaseNotes) {
        const specInputPath: string = tl.getPathInput('releaseNotesFile', true, true) || '';
        cliCommand = utils.cliJoin(cliCommand, '--release-notes-path=' + utils.quote(specInputPath));
        cliCommand = utils.addStringParam(cliCommand, 'releaseNotesSyntax', 'release-notes-syntax', true);
    }
    cliCommand = utils.addStringParam(cliCommand, 'description', 'desc', false);
    execCli(cliPath, workDir, cliCommand, true, true);
}

function performRbSign(cliPath: string, workDir: string): void {
    let cliCommand: string = getCliCmdBase(cliPath, cliRbsCommand, workDir);

    cliCommand = utils.addStringParam(cliCommand, 'passphrase', 'passphrase', false);

    const useCustomRepo: boolean = tl.getBoolInput('useCustomRepo', false);
    if (useCustomRepo) {
        cliCommand = utils.addStringParam(cliCommand, 'customRepoName', 'repo', true);
    }
    execCli(cliPath, workDir, cliCommand, false, true);
}

function performRbDistribute(cliPath: string, workDir: string): void {
    let cliCommand: string = getCliCmdBase(cliPath, cliRbdCommand, workDir);
    try {
        const filePath: string = getDistRulesFilePath(workDir);
        cliCommand = utils.cliJoin(cliCommand, '--dist-rules=' + utils.quote(filePath));
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex as string);
        return;
    }

    const distSync: boolean = tl.getBoolInput('distSync', false);
    if (distSync) {
        cliCommand = utils.cliJoin(cliCommand, '--sync');
        cliCommand = utils.addStringParam(cliCommand, 'maxWaitSync', 'max-wait-minutes', false);
    }
    execCli(cliPath, workDir, cliCommand, true, true);
}

function performRbDelete(cliPath: string, workDir: string): void {
    let cliCommand: string = getCliCmdBase(cliPath, cliRbdelCommand, workDir);
    try {
        const filePath: string = getDistRulesFilePath(workDir);
        cliCommand = utils.cliJoin(cliCommand, '--dist-rules=' + utils.quote(filePath));
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex as string);
        return;
    }
    cliCommand = utils.addBoolParam(cliCommand, 'deleteFromDist', 'delete-from-dist');
    execCli(cliPath, workDir, cliCommand, true, true);
}

function execCli(cliPath: string, workDir: string, cliCommand: string, allowDryRun: boolean, allowInsecureTls: boolean): void {
    if (allowDryRun) {
        cliCommand = utils.addBoolParam(cliCommand, 'dryRun', 'dry-run');
    }
    if (allowInsecureTls) {
        cliCommand = utils.addBoolParam(cliCommand, 'insecureTls', 'insecure-tls');
    }

    try {
        utils.executeCliCommand(cliCommand, process.cwd());
        tl.setResult(tl.TaskResult.Succeeded, 'Build Succeeded.');
    } catch (ex) {
        tl.setResult(tl.TaskResult.Failed, ex as string);
    } finally {
        utils.deleteCliServers(cliPath, workDir, [serverId]);
    }
}

function getDistRulesFilePath(workDir: string): string {
    let filePath: string = '';
    const distRulesSource: string = tl.getInput('distRulesSource', false) || '';
    if (distRulesSource === 'file') {
        filePath = tl.getPathInput('distRulesFilePath', true, true) || '';
        console.log('Using distribution rules file located at ' + filePath);
    } else if (distRulesSource === 'taskConfiguration') {
        const distRulesTaskFile: string = tl.getInput('distRulesTaskFile', true) || '';
        filePath = path.join(workDir, 'distRules' + Date.now() + '.json');
        tl.writeFile(filePath, distRulesTaskFile);
    } else {
        throw new Error('Failed creating distribution rules file, since the provided file source value is invalid.');
    }
    return filePath;
}

function getWorkDir(): string {
    const inputWorkingDirectory: string = tl.getInput('workingDirectory', false) || '';
    const defaultWorkDir: string = tl.getVariable('System.DefaultWorkingDirectory') || process.cwd();
    return utils.determineCliWorkDir(defaultWorkDir, inputWorkingDirectory);
}

/**
 * Returns the base of the CLI command, which includes:
 * CLI path, command prefix, command name, release bundle name & version, and credentials by flags.
 *
 * @param cliPath - Path to the CLI's executable.
 * @param cliCommandName - Command name to run, including prefix.
 * @param workDir - Working directory.
 */
function getCliCmdBase(cliPath: string, cliCommandName: string, workDir: string): string {
    const rbName: string = tl.getInput('rbName', true) || '';
    const rbVersion: string = tl.getInput('rbVersion', true) || '';
    const cliCommand: string = utils.cliJoin(cliPath, cliCommandName, rbName, rbVersion);
    serverId = utils.configureDefaultDistributionServer('distribution_' + cliCommandName.replace(' ', '_'), cliPath, workDir);
    return utils.addServerIdOption(cliCommand, serverId);
}

utils.executeCliTask(RunTaskCbk);

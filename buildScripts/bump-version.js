const fs = require('fs');
const path = require('path');
const assert = require('assert');
const commandLineArgs = require('command-line-args');
const commandLineUsage = require('command-line-usage');
const editJsonFile = require('edit-json-file');
const compareVersions = require('compare-versions');
const editJsonFileOptions = {autosave: true, stringify_width: 4};
const optionDefinitions = [
    {name: 'help', alias: 'h', type: Boolean, description: 'Display this usage guide'},
    {name: 'version', alias: 'v', type: String, description: 'Version to set. Must be bigger than the current version. Format: X.X.X'}
];
const usage = commandLineUsage([
    {
        header: 'Bump version of JFrog Artifactory VSTS extension',
        content: 'Tool to Bump version of JFrog Artifactory VSTS extension. It bumps version in all task.json files and in vss-extension.json.'
    },
    {
        header: 'Options',
        optionList: optionDefinitions
    }
]);
const commandLineArgsOptions = commandLineArgs(optionDefinitions, {camelCase: true});
if (commandLineArgsOptions.help || !commandLineArgsOptions.version) {
    console.log(usage);
    process.exit(commandLineArgsOptions.help ? 0 : 1);
}
const splitVersion = commandLineArgsOptions.version.split('.');

assertVersion();
updateTasksVersion();
updateExtensionVersion();

/**
 * Validate the format of the new version and also that it is larger than the existing version.
 */
function assertVersion() {
    assert.strictEqual(splitVersion.length, 3, 'Version have a format of X.Y.Z');
    let vssExtension = fs.readFileSync('vss-extension.json', 'utf8');
    let vssExtensionJson = JSON.parse(vssExtension);
    assert.strictEqual(compareVersions(commandLineArgsOptions.version, vssExtensionJson.version), 1, 'Input version must be bigger than current version');
}

/**
 * Update versions of all tasks.
 * Tasks' versions are set to be the extension's version.
 */
function updateTasksVersion() {
    let files = fs.readdirSync(path.join('tasks'));
    files.forEach(taskName => {
        console.log('Updating version of task ' + taskName + ' to X.' + splitVersion[1] + "." + splitVersion[2]);
        let taskDir = path.join('tasks', taskName);
        let taskJsonPath = path.join(taskDir, 'task.json');
        if (fs.existsSync(taskJsonPath)) {
            updateTaskJsonWithNewVersion(taskJsonPath)
        } else {
            fs.readdir(taskDir, (err, taskVersionDirs) => {
                if (taskVersionDirs) {
                    taskVersionDirs.forEach(versToBuild => {
                        let taskVersionDir = path.join(taskDir, versToBuild);
                        let taskJsonPath = path.join(taskVersionDir, 'task.json');
                        if (fs.existsSync(taskJsonPath)) {
                            updateTaskJsonWithNewVersion(taskJsonPath);
                        }
                    })
                }
            });
        }
    });
}

function updateTaskJsonWithNewVersion(taskJsonPath) {
    let taskJson = editJsonFile(taskJsonPath, editJsonFileOptions);
    taskJson.set('version', {
        'Minor': splitVersion[1],
        'Patch': splitVersion[2]
    });
}

/**
 * Update version of vss-extension.json.
 */
function updateExtensionVersion() {
    console.log('Updating version of vss-extension.json to ' + commandLineArgsOptions.version);
    let vssExtensionJson = editJsonFile('vss-extension.json', editJsonFileOptions);
    vssExtensionJson.set('version', commandLineArgsOptions.version);
}
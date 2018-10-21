const exec = require('child_process').execSync;
const rimraf = require('rimraf');
const fs = require('fs');
const path = require('path');

cleanExecNpm('pack', 'artifactory-tasks-utils');
installTasks();
cleanExecNpm('i', 'tests');

/**
 * Install tasks.
 */
function installTasks() {
    fs.readdir('tasks', (err, files) => {
        files.forEach(taskName => {
            let taskDir = path.join('tasks', taskName);
            // If a package.json is missing, npm will exec the install command on the parent folder. This will cause an endless install loop.
            if (fs.existsSync(path.join(taskDir, "package.json"))) {
                cleanExecNpm('i', taskDir);
            }
        });
    });
}

/**
 * Clean npm install/pack files.
 * @param cwd - (String) - Current working directory.
 */
function clean(cwd) {
    rimraf.sync(path.join(cwd, 'node_modules'));
    rimraf.sync(path.join(cwd, 'package-lock.json'));
    rimraf.sync(path.join(cwd, '*.tgz'));
}

/**
 * Clean directory and execute npm command.
 * @param command - (String) - The command to execute, i.e. install, pack, etc.
 * @param cwd - (String) - Current working directory.
 */
function cleanExecNpm(command, cwd) {
    clean(cwd);
    exec('npm ' + command + ' -q', {cwd: cwd, stdio: [0, 1, 2]});
}

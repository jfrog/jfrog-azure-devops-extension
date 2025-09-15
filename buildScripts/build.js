const exec = require('child_process').execSync;
const sync = require('rimraf').sync;
const fs = require('fs-extra');
const join = require('path').join;
const TASKS_UTILS_DIR = 'jfrog-tasks-utils';
const TASKS_DIR = 'tasks';
const TESTS_DIR = 'tests';

installJfrogTaskUtils();
installTasks();
installTests();

/**
 *
 * Install JFrog task utils.
 */
function installJfrogTaskUtils() {
    clean(TASKS_UTILS_DIR, true);
    execNpm('i', TASKS_UTILS_DIR);
    exec('npx clean-modules -y "!**/shelljs/src/test.js" --directory ' + join(TASKS_UTILS_DIR, 'node_modules'), { stdio: [0, 1, 2] });
    execNpm('pack', TASKS_UTILS_DIR);
}

/**
 * Install tasks.
 */
function installTasks() {
    fs.readdir(TASKS_DIR, (err, files) => {
        files.forEach((taskName) => {
            let taskDir = join(TASKS_DIR, taskName);
            // We want to ignore files like .DS_Store may exist in TASKS_DIR
            if (!fs.lstatSync(taskDir).isDirectory()) {
                return;
            }
            // If a package.json is missing, npm will exec the install command on the parent folder. This will cause an endless install loop.
            if (fs.existsSync(join(taskDir, 'package.json'))) {
                // tasks/<task-name>/package.json
                clean(taskDir);
                copyTaskUtilsModules(taskDir);
                execNpm('i', taskDir);
            } else {
                // tasks/<task-name>/<task-version>/package.json
                fs.readdir(taskDir, (err, taskVersionDirs) => {
                    taskVersionDirs.forEach((versToBuild) => {
                        let taskVersionDir = join(taskDir, versToBuild);
                        if (fs.existsSync(join(taskVersionDir, 'package.json'))) {
                            clean(taskVersionDir);
                            copyTaskUtilsModules(taskVersionDir);
                            execNpm('i', taskVersionDir);
                        }
                    });
                });
            }
        });
    });
}

/**
 * Install tests.
 */
function installTests() {
    clean(TESTS_DIR);
    copyTaskUtilsModules(TESTS_DIR);
    copyTaskUtilsPackage(TESTS_DIR);
    execNpm('i', TESTS_DIR);
}

/**
 * Copy jfrog-tasks-utils/node_modules to dest/node_modules
 * @param dest - The destination
 */
function copyTaskUtilsModules(dest) {
    fs.copySync(join(TASKS_UTILS_DIR, 'node_modules'), join(dest, 'node_modules'));
}

/**
 * Copy jfrog-tasks-utils package (.tgz file) to destination directory
 * This is needed for tests that reference the package via file: dependency
 * @param {string} dest - The destination directory
 * @throws {Error} If the copy operation fails
 */
function copyTaskUtilsPackage(dest) {
    try {
        // Validate destination directory exists
        if (!fs.existsSync(dest)) {
            throw new Error(`Destination directory does not exist: ${dest}`);
        }

        // Validate source directory exists
        if (!fs.existsSync(TASKS_UTILS_DIR)) {
            throw new Error(`Source directory does not exist: ${TASKS_UTILS_DIR}`);
        }

        const tgzFiles = fs.readdirSync(TASKS_UTILS_DIR).filter((file) => file.endsWith('.tgz'));

        if (tgzFiles.length === 0) {
            console.warn(`No .tgz files found in ${TASKS_UTILS_DIR}`);
            console.warn('This may cause test failures. Ensure "npm pack" was run in jfrog-tasks-utils directory.');
            return;
        }

        if (tgzFiles.length > 1) {
            console.warn(`Multiple .tgz files found: ${tgzFiles.join(', ')}. Using: ${tgzFiles[0]}`);
        }

        const tgzFile = tgzFiles[0];
        const srcPath = join(TASKS_UTILS_DIR, tgzFile);
        const destPath = join(dest, tgzFile);

        // Verify source file exists and has content
        const srcStats = fs.statSync(srcPath);
        if (srcStats.size === 0) {
            throw new Error(`Source file is empty: ${srcPath}`);
        }

        // Copy the file
        fs.copySync(srcPath, destPath);

        // Verify copy was successful
        const destStats = fs.statSync(destPath);
        if (destStats.size !== srcStats.size) {
            throw new Error(`Copy verification failed: source size ${srcStats.size} != dest size ${destStats.size}`);
        }

        console.log(`✓ Successfully copied ${tgzFile} (${srcStats.size} bytes) to ${dest}`);
    } catch (error) {
        console.error(`Error copying tasks-utils package: ${error.message}`);
        throw error; // Re-throw to fail the build if this is critical
    }
}

/**
 * Clean npm install/pack files.
 * @param cwd - (String) - Current working directory.
 * @param cleanPackage (Boolean) - True to clean the 'npm pack' results.
 */
function clean(cwd, cleanPackage) {
    sync(join(cwd, 'node_modules'));
    sync(join(cwd, 'package-lock.json'));
    if (cleanPackage) {
        sync(join(cwd, '*.tgz'));
    }
}

/**
 *
 * @param command - (String) - The command to execute, i.e. install, pack, etc.
 * @param cwd - (String) - Current working directory.
 */
function execNpm(command, cwd) {
    exec('npm ' + command + ' -q --no-fund', { cwd: cwd, stdio: [0, 1, 2] });
}

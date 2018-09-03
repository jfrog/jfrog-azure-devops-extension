let os = require('os');
let exec = require('child_process').exec;

switch (os.type()) {
    case 'Linux':
        exec("bin/build.sh", printOutput);
        break;
    case 'Darwin':
        exec("bin/build.sh", printOutput);
        break;
    case 'Windows_NT':
        exec("bin\\build.bat", printOutput);
        break;
    default:
        throw new Error("Unsupported OS found: " + os.type());
}

function printOutput(stdout, stderr) {
    console.log(stdout);
    console.error(stderr);
}
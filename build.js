let os = require('os');
let exec = require('child_process').exec;
function puts(error, stdout, stderr) { console.log(stdout) }

switch (os.type()) {
    case 'Linux':
        exec("bin/build.sh", puts);
        break;
    case 'Darwin':
        exec("bin/build.sh", puts);
        break;
    case 'Windows_NT':
        exec("bin\\build.bat", puts);
        break;
    default:
        throw new Error("Unsupported OS found: " + os.type());
}

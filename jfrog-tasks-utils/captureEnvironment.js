// Invoked only after the explicitly configured Python activation shell command.
// Its output is captured privately by the parent; never forward it to build logs.
process.stdout.write('\nJFROG_ACTIVATED_ENV=' + JSON.stringify({ env: process.env, cwd: process.cwd() }));

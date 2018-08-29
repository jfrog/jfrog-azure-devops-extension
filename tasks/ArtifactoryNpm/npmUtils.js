
const path = require('path');

module.exports = {
    // Determines the required working directory for running the cli.
    // Decision is based on the default path to run, and the provided path by the user.
    determineCliWorkDir: (defaultPath, providedPath) => {
        if (providedPath) {
            if (path.isAbsolute(providedPath)) {
                return providedPath;
            }
            return path.join(defaultPath, providedPath);
        }
        return defaultPath;
    }
};
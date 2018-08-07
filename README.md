[![Build status](https://ci.appveyor.com/api/projects/status/yhxlpbmakgxlsoyk?svg=true)](https://ci.appveyor.com/project/yahavi/artifactory-vsts-extension-k3cgm)
# Overview
JFrog Artifactory provides tight integration with VSTS and TFS through the **JFrog Artifactory VSTS Extension**.
Beyond managing efficient deployment of your artifacts to Artifactory, the extension lets you capture information about artifacts deployed, dependencies resolved, environment data associated with the build runs and more, 
that effectively facilitates fully traceable builds.
See the full extension documentation at the [VSTS and TFS Artifactory Extension User Guide](https://www.jfrog.com/confluence/display/RTF/VSTS+and+TFS+Artifactory+Extension).

# Download and Installation
The extension is available for installation on your VSTS organization in the [VSTS Marketplace](https://marketplace.visualstudio.com/items?itemName=JFrog.jfrog-artifactory-vsts-extension).
To install the extension TFS, see the [nstall extensions for Team Foundation Server (TFS)](https://docs.microsoft.com/en-us/vsts/marketplace/get-tfs-extensions?view=tfs-2018#install-extensions-while-connected-to-tfs) documentation page.

# Building and Testing the Extension
To build and run the extension sources, please follow these steps:
1. Clone the code from git.
2. To run the tests, use the following commands:
    ```
    npm install -g jfrog-cli-go
    npm test
    ```
3. To Build and create the JFrog Artifactory VSTS extension vsix file, run the following command.
    ```
    npm install
    ```
After the build process is completed, you'll find the vsix file in the project directory.
The vsix file can be loaded into VSTS.

# Pull Requests
We welcome pull requests from the community!
Before creating your first pull request, please join our contributors community by signing [JFrog's CLA](https://secure.echosign.com/public/hostedForm?formid=5IYKLZ2RXB543N).
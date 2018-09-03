|   | Status |
|---|:-----:|
|**Master**|[![Build status](https://ci.appveyor.com/api/projects/status/ki6edykufqy9h5bl/branch/master?svg=true)](https://ci.appveyor.com/project/jfrog-ecosystem/artifactory-vsts-extension/branch/master)
|**Dev**|[![Build status](https://ci.appveyor.com/api/projects/status/ki6edykufqy9h5bl/branch/dev?svg=true)](https://ci.appveyor.com/project/jfrog-ecosystem/artifactory-vsts-extension/branch/dev)|

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
    1. Set the VSTS_ARTIFACTORY_URL, VSTS_ARTIFACTORY_USERNAME and VSTS_ARTIFACTORY_PASSWORD environment variables with your Artifactory URL, username and password.
    2. Run the following commands:
    ```
    npm i -g jfrog-cli-go
    npm t
    ```
3. To Build and create the JFrog Artifactory VSTS extension vsix file, run the following command.
    ```
    npm run create
    ```
After the build process is completed, you'll find the vsix file in the project directory.
The vsix file can be loaded into VSTS and TFS.

# Pull Requests
We welcome pull requests from the community!
## Guidelines
* Before creating your first pull request, please join our contributors community by signing [JFrog's CLA](https://secure.echosign.com/public/hostedForm?formid=5IYKLZ2RXB543N).
* Pull requests should be created on the *dev* branch.
* Please make sure the code is covered by tests. 

# Release Notes
See the release notes [here](https://www.jfrog.com/confluence/display/RTF/VSTS+and+TFS+Artifactory+Extension#VSTSandTFSArtifactoryExtension-ReleaseNotes).

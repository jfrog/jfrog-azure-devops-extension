|Branch|Status|
|:---:|---|
|master|[![Build status](https://ci.appveyor.com/api/projects/status/ki6edykufqy9h5bl/branch/master?svg=true)](https://ci.appveyor.com/project/jfrog-ecosystem/artifactory-azure-devops-extension/branch/master)
|dev|[![Build status](https://ci.appveyor.com/api/projects/status/ki6edykufqy9h5bl/branch/dev?svg=true)](https://ci.appveyor.com/project/jfrog-ecosystem/artifactory-azure-devops-extension/branch/dev)|

# Overview
JFrog Artifactory provides tight integration with Azure DevOps through the **JFrog Artifactory Extension**.
Beyond managing efficient deployment of your artifacts to Artifactory, the extension lets you capture information about artifacts deployed, dependencies resolved, environment data associated with the build runs and more, 
that effectively facilitates fully traceable builds.
See the full extension documentation at the [Artifactory Azure DevOps Extension User Guide](https://www.jfrog.com/confluence/display/JFROG/Artifactory+Azure+DevOps+Extension).

# Download and Installation [![Visual Studio Marketplace](https://vsmarketplacebadge.apphb.com/version-short/JFrog.jfrog-artifactory-vsts-extension.svg)](https://marketplace.visualstudio.com/items?itemName=JFrog.jfrog-artifactory-vsts-extension)
The extension is available for installation on your Azure DevOps organization in the [Azure DevOps Marketplace](https://marketplace.visualstudio.com/items?itemName=JFrog.jfrog-artifactory-vsts-extension).
To install the extension on TFS, see the [install extensions for Team Foundation Server (TFS)](https://docs.microsoft.com/en-us/azure/devops/marketplace/get-tfs-extensions?view=tfs-2018#install-extensions-while-connected-to-tfs) documentation page.

# Building and Testing the Sources
## Building
To build and run the extension sources, please follow these steps:
1. Clone the code from git.
2. To Build and create the JFrog Artifactory extension vsix file, run the following command.
    ```
    npm i
    npm run create
    ```
After the build process is completed, you'll find the vsix file in the project directory.
The vsix file can be loaded into Azure DevOps and TFS.

## Testing
To run the tests, please make sure you are using node 10 or above.

Use the following commands to run from terminal:
1. Set the ADO_ARTIFACTORY_URL, ADO_ARTIFACTORY_USERNAME and ADO_ARTIFACTORY_PASSWORD environment variables with your Artifactory URL, username and password:
    ```
    export ADO_ARTIFACTORY_URL='http://localhost:8081/artifactory'
    export ADO_ARTIFACTORY_USERNAME=admin
    export ADO_ARTIFACTORY_PASSWORD=password
    ```
    
2. Set the ADO_ARTIFACTORY_DOCKER_DOMAIN and ADO_ARTIFACTORY_DOCKER_REPO environment variables with your Artifactory Docker registry domain and Artifactory Docker repository name:
    ```
    export ADO_ARTIFACTORY_DOCKER_DOMAIN='localhost:8081/docker-local'
    export ADO_ARTIFACTORY_DOCKER_REPO=docker-local
    ```
    
3. Run the following commands:
    ```
    npm i -g jfrog-cli-go
    npm t
    ```

Note: If you are running tests via your IDE, make sure you are registering tests with ts-node: `mocha -r ts-node/register tests.ts -t 600000`. 

### Skipping Tests
In order to skip tests, set the ADO_ARTIFACTORY_SKIP_TESTS environment variable with the tests you wish to skip, separated by commas.
The supported values are: **maven**, **gradle**, **npm**, **go**, **nuget**, **dotnet**, **conan**, **pip**, **proxy** and **docker**.

For example, for setting the nuget and docker tests:  
```
export ADO_ARTIFACTORY_SKIP_TESTS=nuget,docker
```
    
# Pull Requests
We welcome pull requests from the community!
## Guidelines
* Before creating your first pull request, please join our contributors community by signing [JFrog's CLA](https://secure.echosign.com/public/hostedForm?formid=5IYKLZ2RXB543N).
* Pull requests should be created on the *dev* branch.
* Please make sure the code is covered by tests. 
* Please run `npm run format` for formatting the code before submitting the pull request.

# Release Notes
See the release notes [here](https://www.jfrog.com/confluence/display/JFROG/Artifactory+Azure+DevOps+Extension#ArtifactoryAzureDevOpsExtension-ReleaseNotes).

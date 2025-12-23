const core = require('@actions/core');
const { ClientSecretCredential } = require('@azure/identity');
const { SecretClient } = require('@azure/keyvault-secrets');
const fs = require('fs');

async function run() {
  try {
    const clientId = core.getInput('client_id', { required: true });
    const clientSecret = core.getInput('client_secret', { required: true });
    const tenantId = core.getInput('tenant_id', { required: true });
    const keyvaultNameInput = core.getInput('keyvault_name', { required: true });
    const secretNamesInput = core.getInput('secret_names', { required: true });

    // Construcción de la URI del Key Vault
    const keyvaultUri = `https://${keyvaultNameInput}.vault.azure.net`;

    const credential = new ClientSecretCredential(
      tenantId,
      clientId,
      clientSecret
    );

    const client = new SecretClient(keyvaultUri, credential);

    let secretNames = [];

    // Caso comodín "*"
    if (secretNamesInput.trim() === '*') {
      core.info('Reading ALL secrets from Key Vault');

      for await (const secretProperties of client.listPropertiesOfSecrets()) {
        secretNames.push(secretProperties.name);
      }
    } else {
      // Lista explícita separada por comas
      secretNames = secretNamesInput
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    }

    if (secretNames.length === 0) {
      core.warning('No secrets found to process');
      return;
    }

    for (const name of secretNames) {
      const secret = await client.getSecret(name);
      const value = secret.value;

      // Output dinámico (disponible como steps.id.outputs.<name>)
      core.setOutput(name, value);

      // Variable de entorno global (disponible para pasos posteriores)
      const envName = name.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
      fs.appendFileSync(
        process.env.GITHUB_ENV,
        `UR73FAC_${envName}=${value}\n`
      );

      core.info(`Secret "${name}" exported as UR73FAC_${envName}`);
    }

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();

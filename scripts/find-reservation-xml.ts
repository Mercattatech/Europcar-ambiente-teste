import axios from 'axios';

async function main() {
  const resNumber = '1207745328';
  const callerCode = '1132581';
  const password = '27112025';
  const endpointUrl = 'https://applications.europcar.com/xrs/resxml';

  const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="search.searchbyid">
    <serviceParameters>
      <reservation resNumber="${resNumber}" />
    </serviceParameters>
  </serviceRequest>
</message>`;

  console.log(`Consultando XRS para reserva ${resNumber}...`);
  console.log(`Endpoint: ${endpointUrl} (callerCode: ${callerCode})\n`);

  const payload = new URLSearchParams();
  payload.append('callerCode', callerCode);
  payload.append('password', password);
  payload.append('XML-Request', xmlRequest);

  try {
    const response = await axios.post(endpointUrl, payload.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      timeout: 20000,
    });

    console.log('=== RESPOSTA XML BRUTA DO XRS ===');
    console.log(response.data);
  } catch (err: any) {
    if (err.response) {
      console.error(`HTTP Status: ${err.response.status}`);
      console.error('Data:', err.response.data);
    } else {
      console.error('Erro de conexão:', err.message);
    }
  }
}

main();

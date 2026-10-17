import {createServer} from 'node:http';
import {createApp} from './app.js';

const app = createApp();
const port = Number(process.env.PORT || 8787);

createServer(async (incoming, outgoing) => {
  try {
    const body = ['GET', 'HEAD'].includes(incoming.method) ? undefined : incoming;
    const request = new Request(`http://${incoming.headers.host}${incoming.url}`, {
      method: incoming.method,
      headers: incoming.headers,
      body,
      duplex: body ? 'half' : undefined,
    });
    const response = await app(request);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error(error);
    outgoing.writeHead(500, {'Content-Type': 'application/json'});
    outgoing.end(JSON.stringify({error: 'internal_server_error'}));
  }
}).listen(port, () => {
  console.log(`Chazoku subscription bridge listening on port ${port}`);
});

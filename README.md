# Patchwork Girl

Patchwork Girl is a toolkit for the Wizard of Oz methodology, aiding the development of software prototypes for early-stage usability tests.

The intended audience of this project are developers looking forward to building software prototypes for use in Wizard of Oz experiments, i.e. programs that need to be remote-controlled manually by human observers. It comprises a minimal protocol over WebSocket for real-time remote control, as well as a server-side application with a web interface. (*For the more experienced reader: think a simple RPC layer over WebSocket with a manual control panel.*)

Implemented types of control:
- Actions (button)
- Numerical values (slider)

## The agent
The toolkit is language-agnostic. Programs being controlled (called the **agents**) can employ any programming language/framework/library with a WebSocket client implementation.

[agents/js-simple](agents/js-simple) contains a simple agent implementation in JavaScript. Detailed information on the implementation is available in the section [Implementing an agent](#implementing-an-agent) below.

## Usage
### Server setup
Pick one of the two options available — the server is implemented with the [Deno](https://deno.land/) runtime and can be deployed to its own distributed cloud service or run on a self-hosted server on the Internet or inside a local network.

#### Deno Deploy
Create a project at [Deno Deploy](https://deno.com/deploy) and follow the instructions there.

```sh
cd server
deployctl deploy --token=<token> --project=<name> main.js
```

After the project is set up, navigate to its settings page and add an environment variable with the name `PASS` and an arbitrary string as the value. This string will be the password into the control panel.

#### Self-hosted
Alternatively, install [Deno](https://deno.land/) on a server and run the server application.

```sh
cd server
export PASS=<password>
deno run --allow-env --allow-read --allow-net main.js
```

The `PASS` environment variable will be the password into the control panel. The port to listen on can be configured through the `PORT` environment variable and defaults to 1026.

It is possible, and suggested, to set up a reverse proxy, forwarding traffic under a path to the port, as well as securing connections with HTTPS. The listing below is a sample Nginx configuration, setting up the server at `https://example.com/patchwork`.

```nginx
server {
  server_name example.com;
  location /patchwork/ {
    proxy_http_version 1.1;
    proxy_pass http://127.0.0.1:1026/;
    proxy_redirect off;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $http_host;
  }
  listen [::]:443 ssl;
  listen 443 ssl;
  # ... snip
}
```

### Accessing the control panel
With the server set up, the control panel can be accessed at:
- **https://\<name\>.deno.dev/**, if set up with Deno Deploy;
- the server’s public IP and port (**http://xx.xx.xx.xx:1026/**), if self-hosted in a straightforward manner;
- the hostname and path (**https://example.com/patchwork**), if using a reverse proxy.

A server can simultaneously serve multiple agents as well as multiple control panel users. Changes will be synchronised among all connections.

The link can be appended with a question mark and the password (**https://\<name\>.deno.dev/?letmein**) to skip the manual authentication step. To avoid potential exploits, such links should only be shared internally in a trusted environment.

### Implementing an agent
An agent is essentially a WebSocket client receiving and sending JSON-encoded text messages.

#### Connection
The agent connects to the server by the same URL as that of the control panel, replacing the protocol **https:** with **wss:** (and **http:** with **ws:**).

#### Message protocol
A message is in text format and is always a JSON-encoded object. When the agent receives a message from the server, it should first inspect its **type** attribute.
- **type** is “**id**”: A greeting message. The client should send a self-introduction message including its name and a list of supported controls.
  - Server’s message:
    - **id** (string): A unique string identifying the current agent.
  - Agent’s reply:
    - **type** (string): Should be “**intro**”.
    - **disp** (string): The displayed name of the agent.
    - **elements** ([object]): A list of supported controls, with each in the following format:
      - **name** (string): The identifier for the control, used internally in programs.
      - **type** (string): “**action**” for one-time actions, “**slider**” for numeric values.
      - **disp** (string): The displayed name of the control.
      - (when **type** is “**slider**”) **min**, **max**, **step**, **val** (number): The minimum, maximum, step, and current values.
- **type** is “**act**”: A signal requiring that a one-time action be carried out. The agent should execute the action and reply with a message indicating that the operation has completed.
  - Server’s message:
    - **ts** (string): A string identifying a timestamp, to be included in the reply.
    - **name** (string): A control identifier, being one of the **name** attributes in the introduction message.
  - Agent’s reply:
    - **type** (string): Should be “**done**”.
    - **ts** (string): The timestamp string from the server, unchanged.
- **type** is “**set**”: A signal requiring that a value (numeric or textual) be changed. The agent should change the corresponding value and reply with a message indicating that the value has been updated.
  - Server’s message:
    - **ts** (string): A string identifying a timestamp, to be included in the reply.
    - **name** (string): A control identifier, being one of the **name** attributes in the introduction message.
    - **val** (string | number): The new value.
  - Agent’s reply:
    - **type** (string): Should be “**upd**”.
    - **ts** (string): The timestamp string from the server, unchanged.
    - **val** (string): The updated value. In most cases this is the same as is requested by the server.

The agent may also actively update its values, by sending a message in the same format as the reply to a “**set**” message, replacing the **ts** attribute with a **name** (string) for the value.

## Roadmap

- Textual values (input box).

## Miscellaneous
The source code is distributed under the **Mulan Permissive Software License, Version 2** ([COPYING.MulanPSL.md](COPYING.MulanPSL.md)). Use case reports, issue reports, and suggestions would be much appreciated!

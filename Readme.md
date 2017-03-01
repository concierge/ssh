## SSH Integration
#### Installation
The easiest way to install this integration is to use KPM.
```sh
/kpm install ssh
```

#### Configuration
Host keys need to be generated before you can use this integration. [This article by Github can help you do that](https://help.github.com/articles/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent/).

To add a configuration, execute each of the following commands (replace each of the angle bracketed strings with the respective information):
```sh
/kpm config ssh hostKey "<path to private key, defaults to ~/.ssh/id_rsa>"
/kpm config ssh listenPort <port number for the SSH server, defaults to 44>
/kpm config ssh listenAddress "<address range to listen on for connections, default is 0.0.0.0>"
/kpm config ssh prompt "<prompt for input, defaults to 'Concierge-bot~$ '>"
/kpm config ssh commandPrefix "/"
```

The username you connect to ssh as will be the username used for your Concierge session.

#### Running
To run SSH, either run `node main.js ssh` when starting Concierge or run `/kpm start ssh` when Concierge is running.

#### Notes

- Multiple connections with the same username will have receive the same output, regardless of which ssh client sent the command.
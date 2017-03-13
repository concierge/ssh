const ssh2 = require('ssh2'),
    figlet = require('figlet'),
    path = require('path'),
    fs = require('fs'),
    readline = require('readline'),
    origWrite = process.stdout.write,
    origErr = process.stderr.write;

class SshIntegration extends shim {
    constructor(config, onMessage) {
        super(config.commandPrefix);
        this._onMessage = onMessage;
        this._config = config;
        this._threads = {};
    }

    sendMessage(message, thread_id) {
        const thread = this._threads[thread_id];
        if (!thread) {
            throw new Error('Invalid thread');
        }
        for (let connection of thread) {
            connection.write(message + '\n');
        }
    }
    
    getUsers(thread_id) {
        const thread = this._threads[thread_id];
        if (!thread) {
            throw new Error('Invalid thread');
        }
        const thread0 = thread[0];
        const users = {};
        users[thread0.username] = {
            name: thread0.username,
            id: thread0.username,
            email: `${thread0.username}@unknown.org`
        };
        return users;
    }
    
    _onAuth(ctx) {
        ctx.accept();
        // Workaround to the username not avalible problem
        ctx._stream.username = ctx.username;
    }

    _onReady() {
        console.debug('Client authenticated.');
    }
    
    _onEnd(ctx) {
        console.debug('Client disconnected');
    }

    _onSession(accept, reject) {
        const session = accept();
        session.once('exec', (accept, reject, info) => {
            reject();
        });

        session.on('pty', (accept, reject, info) => {
            accept();
        });
        
        session.on('shell', (accept, reject) => {
            const stream = accept();
            const username = stream._client._sshstream.username;
            const id = `ssh_${username}`;
            const rl = readline.createInterface({
                input: stream.stdin,
                output: stream.stdout,
                prompt: exports.config.prompt || exports.platform.packageInfo.name.toProperCase() + '~$ ',
                terminal: true
            });

            rl.prompt();

            rl.on('line', line => {
                if (line === 'exit') {
                    rl.close();
                    return;
                }
                
                const event = shim.createEvent(id, id, username, line);
                this._onMessage(this, event);
                rl.prompt();
            });

            rl.on('close', () => {
                const ind = this._threads[id].indexOf(rl);
                this._threads[id].splice(ind, 1);
                if (this._threads[id].length === 0) {
                    delete this._threads[id];
                }
                stream.exit(0);
                stream.end();
                stream.close();
            });

            rl.username = username;
            
            if (!this._threads[id]) {
                this._threads[id] = [];
            }
            this._threads[id].push(rl);
        });
    }

    start() {
        let hk = this._config.hostKey;
        if (!hk) {
            const hd = path.resolve(process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE);
            hk = path.join(hd, '.ssh/id_rsa');
        }
        
        try {
            hk = fs.readFileSync(hk);
        }
        catch(e) {
            console.error('Host keys need to be generated and provided before running this integration.');
            throw e;
        }

        const banner = figlet.textSync(exports.platform.packageInfo.name.toProperCase()) +
            '\n ' + exports.platform.packageInfo.version + '\n------------------------------------';

        this._sshServer = new ssh2.Server({
            hostKeys: [hk],
            banner: banner,
            ident: `${exports.platform.packageInfo.name}/${exports.platform.packageInfo.version} (${exports.__descriptor.name}/${exports.__descriptor.version}, like ssh2js)`
        }, client => {          
            client.on('authentication', this._onAuth.bind(this));
            client.on('ready', this._onReady.bind(this));
            client.on('session', this._onSession.bind(this));
            client.on('end', this._onEnd.bind(this));
        }).listen(this._config.listenPort || 44, this._config.listenAddress || '0.0.0.0', err => {
            if (err) {
                throw new Error(err);
            }
        });
        
        const self = this;
        process.stdout.write = function (data) {
            origWrite.apply(this, arguments);
            for (let thread in self._threads) {
                for (let connection of self._threads[thread]) {
                    connection.write(data);
                }
            }
        };
        process.stderr.write = function (data) {
            origWrite.apply(this, arguments);
            for (let thread in self._threads) {
                for (let connection of self._threads[thread]) {
                    connection.write(data);
                }
            }
        };
    }

    stop() {
        process.stdout.write = origWrite;
        process.stderr.write = origErr;
        
        for (let thread of Object.keys(this._threads)) {
            for (let connection of this._threads[thread]) {
                connection.close();
            }
        }
        this._sshServer.close();
        this._sshServer = null;
    }
};

let serverInstance = null;

exports.getApi = () => serverInstance;

exports.start = callback => {
    serverInstance = new SshIntegration(exports.config, callback);
    serverInstance.start();
};

exports.stop = () => {
    serverInstance.stop();
    serverInstance = null;
};

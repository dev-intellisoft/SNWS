import express from 'express'
import vhost from 'vhost'
import bodyParser from 'body-parser'
import cors from 'cors'
import helmet from 'helmet'
import https from 'https'
import http from 'http'
import fileUpload from 'express-fileupload'
import mustache from  'mustache'
import fs from 'fs'
import socketio from 'socket.io'
import dotenv from 'dotenv'

dotenv.config()

const app = new express()
const _app = new express()

global.server = { get:() => {} }

class Server
{
    constructor ( variables )
    {
        // console.log ( variables )
        this.variables = variables
    }

    get = ( key ) => this.variables[key]
}

class SNWS
{
    constructor ()
    {
        this.init()
        this.sockets = []
        this.hosts = {}
    }

    get_vhosts = async () =>
    {
        try
        {
            let hosts = await import(`${process.env.PWD}/vhosts.json`)

            if ( hosts.default )
                hosts = hosts.default

            return hosts
        }
        catch ( e )
        {
            return []
        }
    }

    static_vhosts = async (domain, dir) => vhost(domain, express.static( dir ))

    async init()
    {
        const hosts = await this.get_vhosts() || []

        try
        {
            app.use(bodyParser.json())
            app.use(bodyParser.text())
            app.use(bodyParser.urlencoded({extended: false}))
            app.use(helmet({
                contentSecurityPolicy: {
                    directives: {
                        defaultSrc: ["'self'"],
                        scriptSrc: ["'self'"],
                        styleSrc: ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
                        imgSrc: ["'self'", 'data:'],
                        connectSrc: ["'self'", 'api.programer.com.br/',
                            'https://api.programer.com.br/',
                            'wss://api.programer.com.br/'],
                        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
                        objectSrc: ["'self'"],
                        mediaSrc: ["'self'"],
                        frameSrc: ["'self'", "api.programer.com.br"],
                    },
                }
            }))
            app.disable(`x-powered-by`)
            app.set(`trust_proxy`, true)
            app.use(cors())
            app.use(fileUpload())

            for ( let i = 0; i < hosts.length; i ++ )
            {
                this.hosts[hosts[i].host] = hosts[i]

                if ( await fs.existsSync(`${this.hosts[hosts[i].host].APP_PATH}/index.js`) )
                {
                    global.APP_PATH = this.hosts[hosts[i].host].APP_PATH || `${process.env.PWD}/www`
                    global.server = await new Server(this.hosts[hosts[i].host])
                    let { Index, Socket } = await import(`${this.hosts[hosts[i].host].APP_PATH}/index.js`)
                    app.use(vhost(hosts[i].host, async (req, res) =>
                    {
                        global.server = await new Server(this.hosts[hosts[i].host])
                        global.APP_PATH = this.hosts[hosts[i].host].APP_PATH || `${process.env.PWD}/www`
                        res.setHeader('Content-Type', 'text/plain')
                        res.end(await new Index(req, res, app))
                    }))

                    this.sockets.push(Socket)
                }
                else if ( await fs.existsSync(`${this.hosts[hosts[i].host].APP_PATH}/index.html`) )
                {
                    app.use(await this.static_vhosts( hosts[i].host, this.hosts[hosts[i].host].APP_PATH))

                    app.use(vhost(hosts[i].host, async (req, res) =>
                    {
                        global.server = await new Server(this.hosts[hosts[i].host])
                        global.APP_PATH = this.hosts[hosts[i].host].APP_PATH || `${process.env.PWD}/www`
                        res.sendFile(`${global.APP_PATH}/index.html`)
                    }))
                }
                else
                {
                    app.use(vhost(hosts[i].host, async (req, res) =>
                    {
                        global.server = await new Server(this.hosts[hosts[i].host])
                        global.APP_PATH = this.hosts[hosts[i].host].APP_PATH || `${process.env.PWD}/www`
                        res.setHeader('Content-Type', 'text/plain')
                        res.end(`No index file!`)
                    }))
                }
            }

            if ( process.env.ssl === `true` )
            {
                var server = https.createServer({}, app)

                for ( let i = 0; i < hosts.length; i ++ )
                {
                    server.addContext(hosts[i].host, {
                        key: fs.readFileSync(hosts[i].ssl_key),
                        cert: fs.readFileSync(hosts[i].ssl_cert)
                    })
                }

                _app.all(`*`, (req, res) => res.redirect("https://" + req.host + req.url))

                _app.listen(80)

                server.listen(443)
            }
            else
            {
                var server = http.createServer(app)
                server.listen(80)
            }

            global.io = socketio(server)

            global.io.on(`connection`, (arg) => {})

            for ( let i = 0; i < this.sockets.length; i ++ )
                new this.sockets[i]()
        }
        catch ( e )
        {
            console.log ( e )
        }
    }
}

new SNWS()

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

const app = new express()

class SNWS
{
    constructor ()
    {

        this.init()
    }

    async get_vhosts ()
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

    async init()
    {

        const hosts = await this.get_vhosts() || []

        try
        {
            app.use(bodyParser.json())
            app.use(bodyParser.text())
            app.use(bodyParser.urlencoded({extended: false}))
            app.use(helmet())
            app.disable(`x-powered-by`)
            app.set(`trust_proxy`, true);
            app.use(cors())
            app.use(fileUpload())

            for ( let i = 0; i < hosts.length; i ++ )
            {
                app.use(vhost(hosts[i].host, async (req, res) =>
                {
                    global.APP_PATH = hosts[i].APP_PATH || `${process.env.PWD}/www`

                    if ( await fs.existsSync(`${global.APP_PATH}/index.js`) )
                    {
                        try
                        {
                            let Index = await import(`${global.APP_PATH}/index.js`)
                            if ( Index.default )
                                Index = Index.default

                            res.setHeader('Content-Type', 'text/plain')
                            res.end(await new Index(req, res, app))
                        }
                        catch ( e )
                        {
                            console.log ( e )
                        }
                    }
                    else if ( await fs.existsSync(`${global.APP_PATH}/index.html`) )
                    {
                        res.sendFile(`${global.APP_PATH}/index.html`)
                    }
                    else
                    {
                        res.setHeader('Content-Type', 'text/plain')
                        res.end(`No index file!`)
                    }
                }))
            }



            // const credentials =
            // {
            //     key: fs.readFileSync(`/usr/local/etc/letsencrypt/live/api.programer.com.br/privkey.pem`),
            //     cert: fs.readFileSync(`/usr/local/etc/letsencrypt/live/api.programer.com.br/fullchain.pem`)
            // }
            //
            //
            const server = https.createServer({}, app)

            for ( let i = 0; i < hosts.length; i ++ )
                server.addContext(hosts[i].host, {
                    key: fs.readFileSync(hosts[i].ssl_key),
                    cert: fs.readFileSync(hosts[i].ssl_cert)
                })

            server.listen(443)
        }
        catch ( e )
        {
            console.log ( e )
        }
    }
}

new SNWS()

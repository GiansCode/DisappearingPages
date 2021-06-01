const moment = require("moment"),
    express = require("express"),
    path = require("path"),
    bodyParser = require('body-parser'),
    DatabaseHandler = require("./modules/database"),
    cors = require('cors'),
    config = require("./config"),
    fetch = require("node-fetch"),
    app = express();

let Website = class Website {
    constructor() {
        this.database = new DatabaseHandler();
        this.config = config;
    }

    async start() {
        const baseURL = this.config.website.baseURL;

        setInterval(() => {
            this.database.checkWebsite(this.database.db);
        }, 5 * 60 * 60 * 1000)

        app.use(express.static(path.join(__dirname, "/dashboard/public")))
            .engine("html", require("ejs").renderFile)
            .set("view engine", "html")
            .set('views', path.join(__dirname, "/dashboard/views"))
            .set("port", this.config.website.port)
            .use(bodyParser.urlencoded({
                extended: false
            }))
            .use(cors())
            .use(bodyParser.json())
            .disable('x-powered-by')
            .use(async function(req, res, next) {
                res.header("Access-Control-Allow-Origin", baseURL);
                res.header("Access-Control-Allow-Headers", "DNT,X-CustomHeader,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Authorization");
                next();
            });

        const renderTemplate = (res, req, template, data = {}) => {
            const baseData = {
                path: req.path
            };
            res.status(200).render(
                path.resolve(__dirname + `${path.sep}dashboard${path.sep}views${path.sep}${template}`),
                Object.assign(baseData, data),
                (err, html) => {
                    res.send(html);
                });
        };

        app.get("/", async(req, res) => {
            return renderTemplate(res, req, "index.ejs")
        })
        app.get("/404", async(req, res) => {
            return renderTemplate(res, req, "not_found.ejs");
        });
        app.get("/:pageid", async(req, res) => {
            const shortURL = req.params.pageid.replace(/[^a-zA-Z0-9]/g, "");
            let proto = `SELECT * FROM db WHERE shorturl=? OR pageid=?`;
            const response = await this.database.db(proto, [shortURL],"get");
            if (!response || response == "no-data") return res.redirect("/404");
            const data = {
                title: response.title,
                description: response.description,
                end: response.date
            }
            return renderTemplate(res, req, "page.ejs", {
                data
            });
        });

        app.post("/send_data", async(req, res) => {
            res.setHeader('Content-Type', 'application/json');
            const body = req.body;

            // Verification of body
            const datasReceived = {
                shortUrl: body.shortUrl ? body.shortUrl.trim() : false,
                title: body.title ? body.title.trim() : false,
                description: body.description ? body.description.trim() : false,
                date: body.date ? body.date.trim() : false,
                captcha: body.captcha ? body.captcha : false
            }

            if (!datasReceived.captcha) {
                return this.stopRequest(res, {
                    "code": 400,
                    "info": "The captcha token is not valid."
                })
            } else {
                const captchaGoogleURL = `https://www.google.com/recaptcha/api/siteverify?secret=${this.config.captcha.serverSide}&response=${datasReceived.captcha}`;

                fetch(captchaGoogleURL).then(res => res.json()).then(data => {
                    if (!data.success ||  data.score < 0.4) {
                        return this.stopRequest(res, {
                            "code": 400,
                            "info": "The captcha token is not valid."
                        })
                    }
                })
            }

            // Create errors array
            let whereError = new Array();
            for (const errors in datasReceived) {
                // Verify if data's is not empty
                if (!datasReceived[errors] && errors != "shortUrl") whereError.push(errors);
            }

            if (whereError.length > 0) {
                // If one of data is empty, returning error.
                return this.stopRequest(res, ({
                    "code": 400,
                    "info": `${whereError.map(r => r).join(", and ")} are not filled`
                }))
            } else {

                // Yes, we can find another errors
                if (datasReceived.title.length >= 20 || datasReceived.title.length < 2) return this.stopRequest(res, {
                    "code": 400,
                    "info": `The page title is too long/ court (between 2 and 20 characters)`
                });
                if (datasReceived.description.length >= 5000 || datasReceived.description.length <= 50) return this.stopRequest(res, {
                    "code": 400,
                    "info": `The page description is too long/ court (between 50 and 5000 characters)`
                });

                if (datasReceived.shortUrl) {
                    if (datasReceived.shortUrl.length >= 10 || datasReceived.shortUrl.length <= 2) return this.stopRequest(res, {
                        "code": 400,
                        "info": `The short url for the page is too long/ court (between 2 and 10 characters)`
                    });
                }

                const dateSepareted = datasReceived.date.split("-");
                if (dateSepareted.length != 3) return this.stopRequest(res, {
                    "code": 400,
                    "info": `The date entered is invalid`
                });
                const d = new Date(datasReceived.date);
                if (d == "Invalid Date") return this.stopRequest(res, {
                    "code": 400,
                    "info": `The date entered is invalid`
                });
                const now = Date.now();

                const timed = d.getTime();

                if (timed < now + 7200000) return this.stopRequest(res, {
                    "code": 400,
                    "info": `The date entered is invalid`
                });

                // If no data is empty, continue !
                if (body.shortUrl) {
                    // So, if the user has give a short URL
                    const shortURL = body.shortUrl.replace(/[^a-zA-Z0-9]/g, "");
                    let proto = `SELECT * FROM db WHERE shorturl=?`;
                    const response = await this.database.db(proto, [shortURL],"get");
                    if (!response || response == "no-data") {

                        //generate webpage URL
                        const code = await this.generateCodeURL(10);
                        await this.database.db("INSERT INTO db (pageid, pageurl, shorturl, date, title, description) VALUES (?, ?, ?, ?, ?, ?)", [code, code, shortURL, timed, body.title, body.description], "run");
                        return this.stopRequest(res, {
                            "code": 200,
                            "info": "The page was created succefully",
                            "accessCode": code
                        })

                    } else {
                        return this.stopRequest(res, {
                            "code": 401,
                            "info": "The short url is already taken."
                        });
                    }
                } else {
                    const code = await this.generateCodeURL(10);
                    await this.database.db("INSERT INTO db (pageid, pageurl, date, title, description) VALUES (?, ?, ?, ?, ?)", [code, code, timed, body.title, body.description], "run");
                    return this.stopRequest(res, {
                        "code": 200,
                        "info": "The page was created succefully",
                        "accessCode": code
                    })
                }
            }
        });

        await app.listen(app.get("port"), () => {
            console.log(`Your website run on the URL : ${baseURL}`);
        });
    }

    async generateCodeURL(number) {
        let code = this.generateCode(number);
        let verified = await this.verifyURL(code);
        while (verified == false) {
            code = this.generateCode(number);
            verified = await this.verifyURL(code);
        }
        return code;
    }

    generateCode(number) {
        let keys = "abcdefghijklmnopqrstubwsyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
        let code = '';
        for (let i = 0; i < number; i++) {
            code += keys.charAt(Math.floor(Math.random() * keys.length));
        }
        return code;
    }

    async verifyURL(code) {
        const res = await this.database.db("SELECT * FROM db WHERE pageid=?", [code], "get");
        if (!res || res == "no-data") {
            return code;
        } else {
            return false;
        }
    }

    stopRequest(res, object) {
        res.end(JSON.stringify(object));
        return true;
    }
}

new Website().start();

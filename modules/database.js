const sql = require("sqlite");
sql.open("src/database.sqlite");

module.exports = class DatabaseHandler {
    db(string, method) {
        return new Promise((resolve, reject) => {
            method ? method : "get";
            sql[method](string).then(row => {
                if (!row) resolve("no-data");
                resolve(row);
            }).catch(err => {
                resolve("no-data");
            })
        });
    }

    piwa(string, array, method) {
        return new Promise((resolve, reject) => {
            method ? method : "get";
            sql[method](string, array).then(row => {
                if (!row) resolve("no-data");
                resolve(row);
            }).catch(err => {
                resolve("no-data");
            })
        });
    }

    async checkWebsite(db) {
        const d = new Date().getTime();
        db(`DELETE FROM db WHERE date <= "${d}"`, "run");
    }

}
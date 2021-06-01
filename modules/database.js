const sql = require("sqlite");
sql.open("src/database.sqlite");

module.exports = class DatabaseHandler {
    db(string, array = [], method = 'get') {
        return new Promise((resolve, reject) => {
            sql[method](string, array).then(row => {
                if (!row) resolve("no-data");
                resolve(row);
            }).catch(err => {
                resolve("no-data");
            })
        });
    }
    async checkWebsite(db) {
        const d = Date.now();
        db(`DELETE FROM db WHERE date <= "${d}"`, [],"run");
    }

}

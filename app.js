require("dotenv").config();

const path = require("path");
const http = require("http");
const express = require("express");
const expressLayouts = require("express-ejs-layouts");
const helmet = require("helmet");
const morgan = require("morgan");
const { Server } = require("socket.io");

const sessionMiddleware = require("./config/session");
const locals = require("./middleware/locals");
const notFound = require("./middleware/not-found");
const errorHandler = require("./middleware/error-handler");

const paymentReconciliation = require("./services/payment-reconciliation.service");

const stripeWebhookController = require("./controllers/api/stripe-webhook.controller");

const clientRoutes = require("./routes/client/index.routes");
const authRoutes = require("./routes/client/auth.routes");
const accountRoutes = require("./routes/client/account.routes");
const careerRoutes = require("./routes/client/career.routes");

const adminRoutes = require("./routes/admin/index.routes");
const driverRoutes = require("./routes/driver/index.routes");
const apiRoutes = require("./routes/api/index.routes");

const clientCartRoutes = require("./routes/client/cart.routes");
const clientCheckoutRoutes = require("./routes/client/checkout.routes");
const clientOrderRoutes = require("./routes/client/order.routes");

const app = express();
const server = http.createServer(app);

const io = new Server(server);

app.set("io", io);

app.disable("x-powered-by");

app.set("view engine", "ejs");
app.set(
    "views",
    path.join(
        __dirname,
        "views"
    )
);

app.set(
    "layout",
    "layouts/client"
);

app.use(
    expressLayouts
);

app.use(
    helmet({
        contentSecurityPolicy:
            false,

        crossOriginResourcePolicy:
            false
    })
);

app.use(
    morgan("dev")
);


/* =========================================================
   STRIPE WEBHOOK — 13.8.5

   DOIT IMPERATIVEMENT ETRE PLACE AVANT :
   - express.urlencoded()
   - express.json()

   Stripe vérifie la signature sur le corps HTTP BRUT.
========================================================= */

app.post(
    "/api/v1/payments/stripe/webhook",

    express.raw({
        type:
            "application/json"
    }),

    stripeWebhookController.handle
);

app.use(
    express.urlencoded({
        extended:
            true
    })
);

app.use(
    express.json({
        limit:
            "2mb"
    })
);

app.use(
    sessionMiddleware
);

app.use(
    locals
);

app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);

app.use(
    "/uploads",
    express.static(
        path.join(
            __dirname,
            "uploads"
        )
    )
);


/* =========================================================
   ROUTES CLIENT
========================================================= */

app.use(
    "/panier",
    clientCartRoutes
);

app.use(
    "/checkout",
    clientCheckoutRoutes
);

app.use(
    "/commande",
    clientOrderRoutes
);

app.use(
    "/",
    clientRoutes
);

app.use(
    "/",
    authRoutes
);

app.use(
    "/",
    accountRoutes
);

app.use(
    "/",
    careerRoutes
);


/* =========================================================
   ADMIN / LIVREUR / API
========================================================= */

app.use(
    "/admin",
    adminRoutes
);

app.use(
    "/livreur",
    driverRoutes
);

app.use(
    "/api/v1",
    apiRoutes
);


/* =========================================================
   SOCKET.IO - ISOLATION DES COMMANDES 13.5.1
========================================================= */

io.on(
    "connection",
    socket => {

        /* =================================================
           REJOINDRE UNE COMMANDE

           IMPORTANT :
           avant de rejoindre la nouvelle commande,
           le socket QUITTE toutes les anciennes rooms order:*.

           Un socket client ne peut donc jamais rester
           abonné simultanément aux commandes A et B.
        ================================================= */

        socket.on(
            "order:join",
            orderReference => {

                const reference =
                    String(
                        orderReference || ""
                    )
                        .trim()
                        .slice(
                            0,
                            60
                        );


                if (!reference) {
                    return;
                }


                for (
                    const room of socket.rooms
                ) {

                    if (
                        room.startsWith(
                            "order:"
                        )
                    ) {

                        socket.leave(
                            room
                        );
                    }
                }


                socket.join(
                    `order:${reference}`
                );


                socket.data.orderReference =
                    reference;
            }
        );


        /* =================================================
           QUITTER EXPLICITEMENT UNE COMMANDE
        ================================================= */

        socket.on(
            "order:leave",
            orderReference => {

                const reference =
                    String(
                        orderReference || ""
                    )
                        .trim()
                        .slice(
                            0,
                            60
                        );


                if (!reference) {
                    return;
                }


                socket.leave(
                    `order:${reference}`
                );


                if (
                    socket.data.orderReference ===
                    reference
                ) {

                    delete socket.data.orderReference;
                }
            }
        );


        /* =================================================
           GPS LIVREUR - 13.6

           Les positions GPS ne sont pas acceptées directement
           depuis Socket.IO.

           Elles arrivent par la route HTTP protégée :
           POST /livreur/livraisons/:reference/position

           Le contrôleur vérifie le livreur et la livraison,
           enregistre la position dans MySQL, puis émet
           driver:location dans la room order:<REFERENCE>.
        ================================================= */

    }
);


/* =========================================================
   404 / ERREURS
========================================================= */

app.use(
    notFound
);

app.use(
    errorHandler
);


/* =========================================================
   SERVEUR
========================================================= */

const port =
    Number(
        process.env.PORT ||
        3000
    );


server.listen(
    port,
    () => {

        console.log(
            `TiopTiop démarré : http://localhost:${port}`
        );

        console.log(
            `Administration : http://localhost:${port}/admin`
        );

        console.log(
            `Livreur : http://localhost:${port}/livreur`
        );

        console.log(
            `API santé : http://localhost:${port}/api/v1/health`
        );


        paymentReconciliation.start();
    }
);


module.exports = {
    app,
    server,
    io
};

const PaymentService = require("../../services/payment.service");

exports.mtnMomoCallback = async function (req, res) {
    try {
        const headerReference = String(req.get("X-Reference-Id") || "").trim();
        const payload = req.body && typeof req.body === "object" ? req.body : {};
        const externalId = String(payload.externalId || "").trim();

        await PaymentService.handleMtnMomoCallback({
            referenceId: headerReference || payload.referenceId || null,
            externalId: externalId || null,
            payload
        });

        return res.status(200).json({ ok: true });
    } catch (error) {
        console.error("Callback MTN MoMo :", error);
        return res.status(200).json({ ok: false });
    }
};

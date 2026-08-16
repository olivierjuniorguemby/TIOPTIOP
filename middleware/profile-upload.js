const multer =
    require("multer");

const path =
    require("path");

const fs =
    require("fs");


/* =========================================================
   DOSSIER
========================================================= */

const uploadDirectory =
    path.join(
        process.cwd(),
        "public",
        "uploads",
        "profiles"
    );


if (!fs.existsSync(uploadDirectory)) {

    fs.mkdirSync(
        uploadDirectory,
        {
            recursive: true
        }
    );
}


/* =========================================================
   STORAGE
========================================================= */

const storage =
    multer.diskStorage({

        destination: (
            req,
            file,
            callback
        ) => {

            callback(
                null,
                uploadDirectory
            );
        },


        filename: (
            req,
            file,
            callback
        ) => {

            const extension =
                path.extname(
                    file.originalname
                ).toLowerCase();


            const filename =
                `avatar-${req.session.user.id}-${Date.now()}${extension}`;


            callback(
                null,
                filename
            );
        }
    });


/* =========================================================
   TYPE DE FICHIER
========================================================= */

function fileFilter(
    req,
    file,
    callback
) {

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];


    if (
        !allowedTypes.includes(
            file.mimetype
        )
    ) {

        return callback(
            new Error(
                "Seules les images JPG, PNG et WEBP sont autorisées."
            )
        );
    }


    callback(
        null,
        true
    );
}


/* =========================================================
   EXPORT
========================================================= */

const profileUpload =
    multer({

        storage,

        fileFilter,

        limits: {

            fileSize:
                5 * 1024 * 1024
        }
    });


module.exports = {
    profileUpload
};
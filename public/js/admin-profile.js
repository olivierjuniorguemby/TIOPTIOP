
    /* =====================================================
       PHOTO DE PROFIL - PREVISUALISATION
    ===================================================== */

    const profilePhoto = document.getElementById('profilePhoto');
    const profilePreview = document.getElementById('profilePreview');
    const avatarLetter = document.getElementById('avatarLetter');

    profilePhoto.addEventListener('change', function () {

        const file = this.files[0];

        if (!file) {
            return;
        }

        const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/webp'
        ];

        if (!allowedTypes.includes(file.type)) {
            alert('Veuillez sélectionner une image JPG, PNG ou WEBP.');
            this.value = '';
            return;
        }

        const reader = new FileReader();

        reader.onload = function (event) {

            profilePreview.src = event.target.result;
            profilePreview.style.display = 'block';

            avatarLetter.style.display = 'none';
        };

        reader.readAsDataURL(file);
    });


    /* =====================================================
       MODAL MOT DE PASSE
    ===================================================== */

    function openPasswordModal() {

        document
            .getElementById('passwordModal')
            .classList.add('active');

        document.body.style.overflow = 'hidden';
    }


    function closePasswordModal() {

        document
            .getElementById('passwordModal')
            .classList.remove('active');

        document.body.style.overflow = '';
    }


    function closePasswordModalOutside(event) {

        if (event.target.id === 'passwordModal') {
            closePasswordModal();
        }
    }


    /* ESC ferme le modal */

    document.addEventListener('keydown', function(event) {

        if (event.key === 'Escape') {
            closePasswordModal();
        }

    });


    /* =====================================================
       DEMO ENREGISTREMENT PROFIL
    ===================================================== */

    document
        .getElementById('profileForm')
        .addEventListener('submit', function(event) {

            event.preventDefault();

            alert('Profil enregistré avec succès.');
        });


    /* =====================================================
       DEMO CHANGEMENT MOT DE PASSE
    ===================================================== */

    document
        .getElementById('passwordForm')
        .addEventListener('submit', function(event) {

            event.preventDefault();

            const currentPassword =
                this.querySelector('[name="currentPassword"]').value;

            const newPassword =
                this.querySelector('[name="newPassword"]').value;

            const confirmPassword =
                this.querySelector('[name="confirmPassword"]').value;

            if (!currentPassword || !newPassword || !confirmPassword) {

                alert('Veuillez remplir tous les champs.');
                return;
            }

            if (newPassword !== confirmPassword) {

                alert('Les deux nouveaux mots de passe ne correspondent pas.');
                return;
            }

            alert('Mot de passe modifié avec succès.');

            this.reset();

            closePasswordModal();
        });

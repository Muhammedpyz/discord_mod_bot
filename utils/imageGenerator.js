const Jimp = require('jimp');
const path = require('path');

async function generateWelcomeImage(member) {
    try {
        // 1. Create a dark background canvas (800x300)
        const image = new Jimp(800, 300, '#1E1F22'); // Standard Discord dark background

        // 2. Fetch User Avatar
        const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
        let avatar;
        try {
            avatar = await Jimp.read(avatarUrl);
        } catch (e) {
            // Fallback to default discord avatar if fetch fails
            avatar = new Jimp(256, 256, '#5865F2');
        }

        // Resize and circle crop avatar (150x150)
        avatar.resize(150, 150);
        avatar.circle();

        // Load fonts
        const fontTitle = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
        const fontSubtitle = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);

        // Draw Avatar in the center-left
        image.composite(avatar, 50, 75);

        // Draw Text
        const welcomeText = "SUNUCUYA HOS GELDIN";
        const username = member.user.tag.toUpperCase();

        image.print(
            fontTitle, 
            230, 90, 
            {
                text: welcomeText,
                alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
            }, 
            550
        );
        image.print(
            fontSubtitle, 
            230, 160, 
            {
                text: username,
                alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
            }, 
            550
        );

        // Return the buffer
        return await image.getBufferAsync(Jimp.MIME_PNG);
    } catch (err) {
        console.error("Image generation error:", err);
        return null;
    }
}

module.exports = { generateWelcomeImage };

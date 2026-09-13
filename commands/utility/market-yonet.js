const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../../db');
const { createContainerMessage, MONO_EMOJIS } = require('../../utils/uiBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('market-yonet')
        .setDescription('Market ürünlerini yönetir.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub =>
            sub.setName('ekle')
                .setDescription('Markete yeni ürün ekler.')
                .addStringOption(opt => opt.setName('isim').setDescription('Ürün ismi').setRequired(true))
                .addIntegerOption(opt => opt.setName('fiyat').setDescription('Satış fiyatı (Jeton)').setRequired(true).setMinValue(1))
                .addStringOption(opt => opt.setName('tur').setDescription('Ürün türü (rol veya esya)').setRequired(true).addChoices(
                    { name: 'Rol', value: 'role' },
                    { name: 'Eşya', value: 'item' }
                ))
                .addStringOption(opt => opt.setName('aciklama').setDescription('Ürün açıklaması').setRequired(false))
                .addRoleOption(opt => opt.setName('verilecek_rol').setDescription('Eğer tür ROL ise, hangi rol verilecek?').setRequired(false))
                .addIntegerOption(opt => opt.setName('stok').setDescription('Stok sayısı (Boş bırakırsanız sınırsız)').setRequired(false).setMinValue(1))
        )
        .addSubcommand(sub =>
            sub.setName('sil')
                .setDescription('Marketten bir ürünü siler.')
                .addIntegerOption(opt => opt.setName('esya_id').setDescription('Silinecek ürünün ID numarası').setRequired(true))
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        const sub = interaction.options.getSubcommand();

        let conn;
        try {
            conn = await db.pool.getConnection();

            if (sub === 'ekle') {
                const name = interaction.options.getString('isim');
                const price = interaction.options.getInteger('fiyat');
                const type = interaction.options.getString('tur');
                const desc = interaction.options.getString('aciklama') || null;
                const role = interaction.options.getRole('verilecek_rol');
                const stock = interaction.options.getInteger('stok') || null;

                if (type === 'role' && !role) {
                    return interaction.editReply(createContainerMessage('Hata', 'Rol türünde ürün eklerken `verilecek_rol` seçeneğini doldurmalısınız.', '#ED4245', [], [], false, true));
                }

                await conn.query(
                    "INSERT INTO economy_shop_items (guild_id, name, description, price, role_id, stock, item_type) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    [interaction.guild.id, name, desc, price, role ? role.id : null, stock, type]
                );

                await interaction.editReply(createContainerMessage('Ürün Eklendi', `<:mono:${MONO_EMOJIS.check || '1531752495292878858'}> **${name}** başarıyla markete eklendi. (Fiyat: ${price})`, '#57F287', [], [], false, true));
            } 
            else if (sub === 'sil') {
                const id = interaction.options.getInteger('esya_id');
                const res = await conn.query("DELETE FROM economy_shop_items WHERE id = ? AND guild_id = ?", [id, interaction.guild.id]);
                
                if (res.affectedRows > 0) {
                    await interaction.editReply(createContainerMessage('Silindi', 'Ürün marketten kaldırıldı.', '#57F287', [], [], false, true));
                } else {
                    await interaction.editReply(createContainerMessage('Hata', 'Ürün bulunamadı.', '#ED4245', [], [], false, true));
                }
            }
        } catch (e) {
            console.error('Market Ynt err:', e);
            await interaction.editReply({ content: 'Bir hata oluştu.' });
        } finally {
            if (conn) conn.release();
        }
    }
};

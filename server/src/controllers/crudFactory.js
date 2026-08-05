// Factory producing user-scoped CRUD handlers for a Mongoose model
module.exports = (Model, allowedFields) => ({
    list: async (req, res, next) => {
        try {
            const docs = await Model.find({ user: req.user._id }).sort('createdAt');
            res.json(docs);
        } catch (err) { next(err); }
    },
    create: async (req, res, next) => {
        try {
            const body = {};
            allowedFields.forEach(f => { if (req.body[f] !== undefined) body[f] = req.body[f]; });
            const doc = await Model.create({ ...body, user: req.user._id });
            res.status(201).json(doc);
        } catch (err) { next(err); }
    },
    update: async (req, res, next) => {
        try {
            const doc = await Model.findOne({ _id: req.params.id, user: req.user._id });
            if (!doc) { res.status(404); throw new Error('Not found'); }
            allowedFields.forEach(f => { if (req.body[f] !== undefined) doc[f] = req.body[f]; });
            await doc.save();
            res.json(doc);
        } catch (err) { next(err); }
    },
    remove: async (req, res, next) => {
        try {
            const doc = await Model.findOneAndDelete({ _id: req.params.id, user: req.user._id });
            if (!doc) { res.status(404); throw new Error('Not found'); }
            res.json({ id: req.params.id, deleted: true });
        } catch (err) { next(err); }
    }
});

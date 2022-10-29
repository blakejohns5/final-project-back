import { SongModel, GenreModel, UserModel } from "../models/index.js";
import cloudinary from "../utils/cloudinary.js";
import paginate from "express-paginate";

const getAllSongs = async (req, res, next) => {
  const { limit, page } = req.query;

  try {
    const [result, itemCount] = await Promise.all([
      SongModel.find({})
        .limit(limit)
        .skip(req.skip)
        .populate({
          path: "album",
          select: ["title"],
        })
        .populate({
          path: "uploadedBy",
          select: ["username", "firstName", "lastName", "avatar", "email"],
        })
        .populate({
          path: "genre",
          select: ["title"],
        })
        .populate({
          path: "likedBY",
          select: ["username"],
        })
        .lean()
        .exec(),
      SongModel.count({}),
    ]);
    const pageCount = Math.ceil(itemCount / limit);
    res.send({
      has_more: paginate.hasNextPages(req)(pageCount),
      page,
      pageCount,
      songs: result,
    });
  } catch (error) {
    next(error);
  }
};

const getSongById = async (req, res, next) => {
  const { id } = req.params;
  try {
    const song = await SongModel.findByIdAndUpdate({ _id: id }).populate({
      path: "album",
    });
    res.status(200).send(song);
  } catch (error) {
    next(error);
  }
};

const createSongWithCloudinary = async (req, res, next) => {
  const songPath = req.files.video[0].path;
  const thumbnailPath = req.files.image[0].path;
  const title = req.body.title;
  const { userId, genre } = req.body;

  console.log(genre);

  try {
    const uploadedSong = await cloudinary.uploader.upload(songPath, {
      folder: "songs",
      resource_type: "video",
    });

    const uploadThummail = await cloudinary.uploader.upload(thumbnailPath, {
      folder: "images",
      resource_type: "image",
    });

    const findGenre = await GenreModel.find({ title: genre });

    const { url: songUrl, duration, public_id } = uploadedSong;
    const { url: thumbnailUrl } = uploadThummail;

    const newSong = await SongModel.create({
      title: title,
      fileUrl: songUrl,
      thumbnail: thumbnailUrl,
      duration: duration,
      cloudinaryId: public_id,
      uploadedBy: userId,
      genre: findGenre[0]._id,
    });
    res.status(200).send({ newSong });
  } catch (error) {
    next(error);
  }
};

const updateSong = async (req, res, next) => {
  const { title, released, album, genre } = req.body;
  const { id } = req.params;
  try {
    const songToUpdate = await SongModel.findOneAndUpdate(
      { id: id },
      {
        $set: {
          title,
          released,
          album,
        },
      },
    );
    //  update genre
    const conditions = { title: genre, songs: { $ne: id } };
    const update = {
      $addToSet: { songs: id },
    };
    const updateGenre = await GenreModel.findOneAndUpdate(conditions, update);
    res.status(201).send({
      success: "Song was updated",
    });
  } catch (error) {
    next(error);
  }
};

const deleteSong = async (req, res, next) => {
  const { id } = req.params;

  try {
    const songToDelete = await SongModel.findOneAndDelete({ _id: id });
    res.status(200).send({ success: "Song was deleted" });
  } catch (error) {
    next(error);
  }
};

// Likes

const likeASong = async (req, res, next) => {
  const { id } = req.params;
  const { userId } = req.body;
  try {
    const conditions = { _id: id, likedBY: { $ne: userId } };
    const update = {
      $addToSet: { likedBY: userId },
    };
    const song = await SongModel.findByIdAndUpdate(conditions, update);
    const user = await UserModel.findByIdAndUpdate(
      { _id: userId, likedSongs: { $ne: id } },
      {
        $addToSet: { likedSongs: id },
      },
    );
    res.status(200).send({ song, user });
  } catch (error) {
    res.status(500).send({
      error: "Something went wrong",
      errorMsg: error.message,
    });
  }
};

const deleteLike = async (req, res, next) => {
  const { id } = req.params;
  const { userId } = req.body;
  console.log(id, userId);
  try {
    const conditions = { _id: id, likedBY: { $in: userId } };
    const update = {
      $pull: { likedBY: userId },
    };
    const song = await SongModel.findByIdAndUpdate(conditions, update);
    const user = await UserModel.findByIdAndUpdate(
      { _id: userId, likedSongs: { $in: id } },
      {
        $pull: { likedSongs: id },
      },
    );

    res.status(200).send({ song: song, user: user });
  } catch (error) {
    next(error);
  }
};

const playSong = async (req, res, next) => {
  const { id } = req.params;
  try {
    const songToPlay = await SongModel.findById({ _id: id })
      .populate({
        path: "artist",
        select: ["artistName"],
      })
      .populate({
        path: "album",
        select: ["title"],
      })
      .lean()
      .exec();

    const { title, artist, fileUrl, imgUrl, album } = songToPlay;

    res.status(200).send({
      song: {
        title,
        artist,
        fileUrl,
        imgUrl,
        album,
      },
    });
  } catch (error) {
    next(error);
  }
};

export {
  getAllSongs,
  getSongById,
  updateSong,
  deleteSong,
  createSongWithCloudinary,
  likeASong,
  deleteLike,
  playSong,
};

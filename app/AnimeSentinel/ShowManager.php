<?php

namespace App\AnimeSentinel;

use App\Show;

class ShowManager
{
  /**
   * Adds the show with the requested title to the database.
   * Will also search for any currently existing episodes.
   */
  public static function addShowWithTitle($title) {
    // Confirm this show isn't already in our databse
    if (!empty(Show::withTitle($title)->first())) {
      flash_error('The requested show has already been added to the database.');
      return;
    }

    // Find this show on MAL and get it's id
    $mal = MyAnimeList::searchStrict($title);

    if (!empty($mal)) {
      // Create a new show with the proper data
      $show = Show::create(MyAnimeList::getAnimeData($mal->id));
      Self::updateThumbnail($show);
    } else {
      // Create a mostly empty show because we don't have MAL data
      $show = Show::create([
        'title' => $title,
        'alts' => [$title],
        'description' => 'No Description Available',
      ]);
    }

    // Call the function to find existing episodes
    EpisodeManager::findVideosForShow($show);

    // Return the show object
    return $show;
  }

  /**
   * Updates the cached database information for the requested show.
   * If episodes is set to true, also updates episode information.
   */
  public static function updateShowCache($show, $episodes = false) {
    // If the mal id is not known yet, try to find it first
    if (!isset($show->mal_id)) {
      $mal = MyAnimeList::searchStrict($show->title);
      if (!empty($mal)) {
        $show->update(MyAnimeList::getAnimeData($mal->id));
        Self::updateThumbnail($show);
        $episodes = true;
      }
    }

    // Otherwise just update the cache
    else {
      $show->update(MyAnimeList::getAnimeData($show->mal_id));
      Self::updateThumbnail($show);
    }

    // Call the function to find existing episodes if requested
    if ($episodes) {
      EpisodeManager::findVideosForShow($show);
    }

    // Return the show object
    return $show;
  }

  /**
   * Downloads the show's thumbnail from MAL.
   */
  private static function updateThumbnail($show) {
    $remote = 'http://cdn.myanimelist.net/images/anime/'.str_replace('-', '/', $show->thumbnail_id);
    $local = __DIR__.'/../../public/media/thumbnails/'.$show->thumbnail_id;
    copy($remote, $local);
  }
}
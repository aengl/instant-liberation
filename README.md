# Instant Liberation

Want to leave Instagram, or integrate a feed on your website in a GDPR friendly way?

This project offers you a CLI that can download data from instagram and mirror its contents, even for private profiles.

## Installation

1.  Make sure [Node.js](https://nodejs.org/en/download/) is installed and up-to-date:

    ```
    brew install node
    ```

1.  Install `instalib` globally via `npm`:

    ```
    npm install -g https://github.com/aengl/instant-liberation
    ```

1.  Repeat the previous step to update to the latest version.

## Usage

- Store session (for private profiles):

  ```
  instalib login
  ```

  A browser will open. Simply log in and close the browser window again. Your session is now cached until it expires.

  ⚠️ The session information will be saved in your home directory in `~/.instalib`. The folder can be removed at any point and is not used for anything else.

- Download profile data:

  ```
  instalib liberate <url_to_profile> -o instagram.yml
  ```

- Mirror images and videos:

  ```
  instalib mirror instagram.yml
  ```

  Only `detail.display_url` is mirrored by default (the full size images). If you want to mirror additional files, just call the command repeatedly with different flags, e.g.:

  ```
  instalib mirror instagram.yml -f detail.display_url -o media/images/
  instalib mirror instagram.yml -f detail.video_url -o media/videos/
  ```

  Once downloaded, the field in the data file will be replaced by the relative path to the downloaded file. If the command fails due to an Instagram block, simply re-run the command again and it will skip already downloaded files.

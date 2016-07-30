<?php

function flash($content, $level) {
  $message = new stdClass();
  $message->body = $content;
  $message->type = 'alert-'.$level;

  $messages = Session::pull('alerts_'.$level);
  $messages[] = $message;
  Session::flash('alerts_'.$level, $messages);
}

function flash_info($content) {
  flash($content, 'info');
}

function flash_success($content) {
  flash($content, 'success');
}

function flash_warning($content) {
  flash($content, 'warning');
}

function flash_error($content) {
  flash($content, 'error');
}

function player_support($filename) {
  if (str_ends_with($filename, '.mp4')) {
    return true;
  }
  return false;
}

// String Helpers //

function str_get_between($string, $start, $end = '') {
  // TODO: improve this function

  $string = ' ' . $string;
  $ini = strpos($string, $start);
  if ($ini == 0) return '';
  $ini += strlen($start);

  if (empty($end)) {
    return substr($string, $ini);
  } else {
    $len = strpos($string, $end, $ini) - $ini;
    return substr($string, $ini, $len);
  }
}

function str_starts_with($haystack, $needle) {
    // search backwards starting from haystack length characters from the end
    return $needle === "" || strrpos($haystack, $needle, - strlen($haystack)) !== false;
}

function str_ends_with($haystack, $needle) {
    // search forward starting from end minus needle length characters
    return $needle === "" || (($temp = strlen($haystack) - strlen($needle)) >= 0 && strpos($haystack, $needle, $temp) !== false);
}

function str_urlify($string) {
  $remove = ['★', '!', ';', ':', '.', ','];

  $string = str_replace('---', '-', str_replace(' ', '-', strtolower(trim($string))));
  foreach ($remove as $char) {
    $string = str_replace($char, '', $string);
  }

  return $string;
}
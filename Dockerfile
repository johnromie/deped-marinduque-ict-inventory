FROM php:8.3-apache

RUN docker-php-ext-install pdo pdo_sqlite

WORKDIR /var/www/html
COPY . /var/www/html

RUN mkdir -p /var/data /var/www/html/data \
  && chown -R www-data:www-data /var/data /var/www/html/data

ENV DB_PATH=/var/data/database.sqlite

EXPOSE 80

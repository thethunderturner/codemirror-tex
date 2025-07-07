import { dest, src, task, series } from 'gulp';
import sourcemaps from 'gulp-sourcemaps';
import { join } from 'path';
import webpack from 'webpack';
import { createProject } from 'gulp-typescript';
import WebpackDevServer from 'webpack-dev-server';
import webpackConfig from './webpack.config';

const tsProject = createProject('tsconfig.build.json');

function build() {
  return src(['src/**/*.ts', 'src/**/*.js', 'src/**/*.json'])
    .pipe(sourcemaps.init())
    .pipe(tsProject())
    .pipe(sourcemaps.write('.', { includeContent: false, sourceRoot: './' }))
    .pipe(dest('dist'));
}

// NEW: Task so gulp can copy the ./mathjax.snippet.json file
function copyJson() {
  return src('src/**/*.json').pipe(dest('dist'));
}

task('build', series(build, copyJson));

async function serve() {
  const devServerConfig = {
    static: {
      directory: join(__dirname, 'playground'),
    },
    compress: true,
    host: '127.0.0.1',
    port: 9000,
  };

  const compiler = webpack(webpackConfig);
  const server = new WebpackDevServer(devServerConfig, compiler);

  await server.start();
}
task('serve', serve);
